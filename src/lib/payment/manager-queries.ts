// ============================================================================
// Lady E Luck Portal — Manager Payment Aggregate Queries (SERVER ONLY)
//
// SECURITY:
//   - Every function MUST receive shopId from the authenticated server session,
//     never from client input.
//   - Returns are typed DTOs — no token fields, no raw email bodies.
//   - All aggregations happen in the DB, not in client JS.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ManagerPaymentTotals,
  ManagerPaymentTransaction,
  TagHistoryEntry,
  SyncLogRow,
  GmailConnectionRow,
  NeedsReviewRow,
  ManagerTransactionFilters,
  ActivityType,
  TransactionStatus,
} from "./payment-types";

// ---------------------------------------------------------------------------
// Financial totals (daily + period)
// ---------------------------------------------------------------------------

export async function getManagerPaymentTotals(
  shopId: string,
  periodStart: string,
  periodEnd: string,
  timezone = "America/Chicago"
): Promise<ManagerPaymentTotals> {
  const supabase = createClient();

  // Use DB-side aggregation so totals are never computed client-side.
  // Only confirmed + is_counted rows contribute to financial totals.
  const { data: rows } = await supabase
    .from("payment_transactions")
    .select("activity_type, status, amount, provider")
    .eq("shop_id", shopId)
    .gte("occurred_at", `${periodStart}T00:00:00.000Z`)
    .lte("occurred_at", `${periodEnd}T23:59:59.999Z`);

  const result: ManagerPaymentTotals = {
    shop_id: shopId,
    period_start: periodStart,
    period_end: periodEnd,
    incoming_total: 0,
    incoming_cashapp: 0,
    incoming_chime: 0,
    outgoing_total: 0,
    outgoing_cashapp: 0,
    outgoing_chime: 0,
    net_activity: 0,
    request_sent_count: 0,
    request_sent_total: 0,
    request_received_count: 0,
    request_received_total: 0,
    refunded_count: 0,
    refunded_total: 0,
    failed_count: 0,
    needs_review_count: 0,
    duplicate_count: 0,
  };

  for (const row of rows ?? []) {
    const amount = Number(row.amount ?? 0);
    const type = row.activity_type as ActivityType | null;
    const status = row.status as TransactionStatus;
    const provider = row.provider as string;

    // Only confirmed rows count toward confirmed totals
    if (status === "confirmed") {
      if (type === "incoming") {
        result.incoming_total += amount;
        if (provider === "CashApp") result.incoming_cashapp += amount;
        if (provider === "Chime") result.incoming_chime += amount;
      } else if (type === "outgoing") {
        result.outgoing_total += amount;
        if (provider === "CashApp") result.outgoing_cashapp += amount;
        if (provider === "Chime") result.outgoing_chime += amount;
      }
    }

    // Non-financial counts (regardless of status)
    if (type === "request_sent") {
      result.request_sent_count++;
      result.request_sent_total += amount;
    } else if (type === "request_received") {
      result.request_received_count++;
      result.request_received_total += amount;
    } else if (type === "refunded") {
      result.refunded_count++;
      result.refunded_total += amount;
    } else if (type === "failed" || status === "failed") {
      result.failed_count++;
    }

    if (status === "needs_review") result.needs_review_count++;
    if (status === "duplicate") result.duplicate_count++;
  }

  result.net_activity = result.incoming_total - result.outgoing_total;
  return result;
}

// ---------------------------------------------------------------------------
// Manager-visible transaction list (paginated, with all fields)
// ---------------------------------------------------------------------------

export async function getManagerTransactions(
  shopId: string,
  filters: ManagerTransactionFilters = {}
): Promise<{ data: ManagerPaymentTransaction[]; hasMore: boolean; nextCursor: string | null }> {
  const supabase = createClient();
  const limit = Math.min(filters.limit ?? 50, 100);

  let query = supabase
    .from("payment_transactions")
    .select(
      "id, occurred_at, email_received_at:email_event_id(email_received_at), " +
      "provider, activity_type, direction, status, amount, " +
      "payment_account_id, customer_name, customer_payment_tag, " +
      "normalized_customer_payment_tag, payment_note, provider_transaction_id, " +
      "player_match_status, is_counted, review_reason, player_mapping_id"
    )
    .eq("shop_id", shopId)
    .order("occurred_at", { ascending: false })
    .limit(limit + 1);

  if (filters.cursor) {
    query = query.lt("occurred_at", filters.cursor);
  }
  if (filters.dateStart) {
    query = query.gte("occurred_at", `${filters.dateStart}T00:00:00.000Z`);
  }
  if (filters.dateEnd) {
    query = query.lte("occurred_at", `${filters.dateEnd}T23:59:59.999Z`);
  }
  if (filters.provider) {
    query = query.eq("provider", filters.provider);
  }
  if (filters.activityType) {
    query = query.eq("activity_type", filters.activityType);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.accountId) {
    query = query.eq("payment_account_id", filters.accountId);
  }
  if (filters.searchTag?.trim()) {
    const norm = filters.searchTag.replace(/[$\s]/g, "").toLowerCase();
    query = query.ilike("normalized_customer_payment_tag", `%${norm}%`);
  }
  if (filters.amountMin != null) {
    query = query.gte("amount", filters.amountMin);
  }
  if (filters.amountMax != null) {
    query = query.lte("amount", filters.amountMax);
  }

  const { data: rawRows } = await query;
  const rows = rawRows ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Batch-fetch account names and player names
  const rawPage = page as unknown as Record<string, unknown>[];
  const accountIds = [...new Set(rawPage.map((r) => r.payment_account_id as string | null).filter(Boolean))];
  const mappingIds = [...new Set(rawPage.map((r) => r.player_mapping_id as string | null).filter(Boolean))];

  const [accountsRes, mappingsRes] = await Promise.all([
    accountIds.length > 0
      ? supabase.from("payment_accounts").select("id, tag, account_display_name").in("id", accountIds)
      : Promise.resolve({ data: [] }),
    mappingIds.length > 0
      ? supabase.from("player_payment_tags").select("id, player_name").in("id", mappingIds)
      : Promise.resolve({ data: [] }),
  ]);

  const accountMap = new Map(
    ((accountsRes.data as unknown as { id: string; tag: string | null; account_display_name: string | null }[]) ?? [])
      .map((a) => [a.id, a])
  );
  const mappingMap = new Map(
    ((mappingsRes.data as unknown as { id: string; player_name: string | null }[]) ?? [])
      .map((m) => [m.id, m])
  );

  // Apply player name search post-join
  let result: ManagerPaymentTransaction[] = (page as unknown as Record<string, unknown>[]).map((r): ManagerPaymentTransaction => {
    const account = r.payment_account_id ? accountMap.get(r.payment_account_id as string) : null;
    const mapping = r.player_mapping_id ? mappingMap.get(r.player_mapping_id as string) : null;
    const emailEventData = r.email_received_at as Record<string, unknown> | null;

    return {
      id: r.id as string,
      occurred_at: r.occurred_at as string,
      email_received_at: emailEventData?.email_received_at as string | null ?? null,
      provider: r.provider as ManagerPaymentTransaction["provider"],
      activity_type: (r.activity_type ?? "incoming") as ActivityType,
      direction: r.direction as ManagerPaymentTransaction["direction"],
      status: r.status as TransactionStatus,
      amount: Number(r.amount),
      payment_account_id: r.payment_account_id as string | null,
      payment_account_name: account?.account_display_name ?? account?.tag ?? null,
      our_account_identifier: account?.tag ?? null,
      counterparty_name: r.customer_name as string | null,
      counterparty_tag: r.customer_payment_tag as string | null,
      normalized_counterparty_tag: r.normalized_customer_payment_tag as string | null,
      payment_note: r.payment_note as string | null,
      provider_transaction_id: r.provider_transaction_id as string | null,
      player_name: mapping?.player_name ?? null,
      player_match_status: r.player_match_status as ManagerPaymentTransaction["player_match_status"],
      is_counted: r.is_counted as boolean,
      review_reason: r.review_reason as string | null,
      gmail_message_id: null, // never expose to browser
      gmail_thread_id: null,
      email_subject: null,
      gmail_connection_id: null,
    };
  });

  if (filters.searchPlayer?.trim()) {
    const needle = filters.searchPlayer.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.player_name?.toLowerCase().includes(needle) ||
        t.counterparty_name?.toLowerCase().includes(needle)
    );
  }
  if (filters.searchNote?.trim()) {
    const needle = filters.searchNote.trim().toLowerCase();
    result = result.filter((t) => t.payment_note?.toLowerCase().includes(needle));
  }

  const nextCursor = hasMore && rawPage.length > 0 ? rawPage[rawPage.length - 1].occurred_at as string : null;
  return { data: result, hasMore, nextCursor };
}

// ---------------------------------------------------------------------------
// Tag history (Customers & Payment Tags)
// ---------------------------------------------------------------------------

export async function getTagHistory(shopId: string): Promise<TagHistoryEntry[]> {
  const supabase = createClient();

  const { data: tags } = await supabase
    .from("player_payment_tags")
    .select(
      "id, shop_id, provider, payment_tag, normalized_payment_tag, " +
      "player_name, facebook_name, game_username, primary_game, " +
      "verification_status, status, created_at, updated_at, " +
      "added_by:profiles!added_by(full_name), " +
      "verified_by_profile:profiles!verified_by(full_name)"
    )
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false });

  if (!tags?.length) return [];

  // Batch aggregate transaction counts + totals per tag
  const normalizedTags = (tags as unknown as Record<string, unknown>[]).map((t) => t.normalized_payment_tag as string);

  const { data: txnAggRows } = await supabase
    .from("payment_transactions")
    .select("normalized_customer_payment_tag, amount, activity_type, status, occurred_at")
    .eq("shop_id", shopId)
    .in("normalized_customer_payment_tag", normalizedTags);

  // Build aggregate map
  const aggMap = new Map<
    string,
    {
      count: number;
      incomingTotal: number;
      outgoingTotal: number;
      firstSeen: string | null;
      lastSeen: string | null;
    }
  >();

  for (const txn of (txnAggRows as unknown as Record<string, unknown>[]) ?? []) {
    const key = txn.normalized_customer_payment_tag as string;
    if (!key) continue;
    const agg = aggMap.get(key) ?? {
      count: 0,
      incomingTotal: 0,
      outgoingTotal: 0,
      firstSeen: null,
      lastSeen: null,
    };
    agg.count++;
    const amount = Number(txn.amount ?? 0);
    if (txn.activity_type === "incoming" && txn.status === "confirmed") {
      agg.incomingTotal += amount;
    }
    if (txn.activity_type === "outgoing" && txn.status === "confirmed") {
      agg.outgoingTotal += amount;
    }
    const occ = txn.occurred_at as string;
    if (!agg.firstSeen || occ < agg.firstSeen) agg.firstSeen = occ;
    if (!agg.lastSeen || occ > agg.lastSeen) agg.lastSeen = occ;
    aggMap.set(key, agg);
  }

  return (tags as unknown as Record<string, unknown>[]).map((tag): TagHistoryEntry => {
    const agg = aggMap.get(tag.normalized_payment_tag as string) ?? {
      count: 0,
      incomingTotal: 0,
      outgoingTotal: 0,
      firstSeen: null,
      lastSeen: null,
    };
    const addedByObj = tag.added_by as { full_name: string | null } | null;
    const verifiedByObj = tag.verified_by_profile as { full_name: string | null } | null;
    return {
      id: tag.id as string,
      shop_id: tag.shop_id as string,
      provider: tag.provider as TagHistoryEntry["provider"],
      payment_tag: tag.payment_tag as string,
      normalized_payment_tag: tag.normalized_payment_tag as string,
      player_name: tag.player_name as string | null,
      facebook_name: tag.facebook_name as string | null,
      game_username: tag.game_username as string | null,
      primary_game: tag.primary_game as string | null,
      verification_status: tag.verification_status as TagHistoryEntry["verification_status"],
      status: tag.status as "active" | "inactive",
      transaction_count: agg.count,
      confirmed_incoming_total: agg.incomingTotal,
      confirmed_outgoing_total: agg.outgoingTotal,
      first_seen_at: agg.firstSeen,
      last_seen_at: agg.lastSeen,
      added_by_name: addedByObj?.full_name ?? null,
      verified_by_name: verifiedByObj?.full_name ?? null,
      created_at: tag.created_at as string,
      updated_at: tag.updated_at as string,
    };
  });
}

// ---------------------------------------------------------------------------
// Needs Review queue
// ---------------------------------------------------------------------------

export async function getNeedsReview(shopId: string): Promise<NeedsReviewRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("payment_transactions")
    .select(
      "id, shop_id, occurred_at, provider, activity_type, status, amount, " +
      "customer_name, customer_payment_tag, payment_note, review_reason, created_at"
    )
    .eq("shop_id", shopId)
    .in("status", ["needs_review", "duplicate", "failed"])
    .order("created_at", { ascending: false })
    .limit(100);

  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r): NeedsReviewRow => ({
    id: r.id as string,
    shop_id: r.shop_id as string,
    occurred_at: r.occurred_at as string,
    provider: r.provider as NeedsReviewRow["provider"],
    activity_type: (r.activity_type ?? null) as ActivityType | null,
    status: r.status as TransactionStatus,
    amount: Number(r.amount ?? 0),
    counterparty_name: r.customer_name as string | null,
    counterparty_tag: r.customer_payment_tag as string | null,
    payment_note: r.payment_note as string | null,
    review_reason: r.review_reason as string | null,
    email_subject: null,
    created_at: r.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Sync logs
// ---------------------------------------------------------------------------

export async function getSyncLogs(shopId: string, limit = 50): Promise<SyncLogRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("payment_sync_logs")
    .select(
      "id, shop_id, gmail_connection_id, sync_type, started_at, completed_at, " +
      "status, emails_found, emails_processed, records_created, records_skipped, " +
      "errors_found, error_summary, history_id_start, history_id_end, " +
      "connection:gmail_connections!gmail_connection_id(email_address)"
    )
    .eq("shop_id", shopId)
    .order("started_at", { ascending: false })
    .limit(limit);

  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r): SyncLogRow => {
    const conn = (r.connection as unknown as { email_address?: string } | null);
    return {
      id: r.id as string,
      shop_id: r.shop_id as string,
      gmail_connection_id: r.gmail_connection_id as string | null,
      gmail_address: conn?.email_address ?? null,
      sync_type: r.sync_type as SyncLogRow["sync_type"],
      started_at: r.started_at as string,
      completed_at: r.completed_at as string | null,
      status: r.status as SyncLogRow["status"],
      emails_found: Number(r.emails_found ?? 0),
      emails_processed: Number(r.emails_processed ?? 0),
      records_created: Number(r.records_created ?? 0),
      records_skipped: Number(r.records_skipped ?? 0),
      errors_found: Number(r.errors_found ?? 0),
      error_summary: r.error_summary as string | null,
      history_id_start: r.history_id_start as string | null,
      history_id_end: r.history_id_end as string | null,
    };
  });
}

// ---------------------------------------------------------------------------
// Gmail connections for manager UI
// ---------------------------------------------------------------------------

export async function getGmailConnections(shopId: string): Promise<GmailConnectionRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("gmail_connections")
    .select(
      "id, shop_id, payment_account_id, email_address, connection_status, " +
      "watch_expires_at, last_synced_at, last_sync_attempt_at, last_error_message, connected_at, " +
      "account:payment_accounts!payment_account_id(tag, account_display_name)"
    )
    .eq("shop_id", shopId)
    .order("connected_at", { ascending: false });

  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r): GmailConnectionRow => {
    const acct = (r.account as unknown as { tag: string | null; account_display_name: string | null } | null);
    return {
      id: r.id as string,
      shop_id: r.shop_id as string,
      payment_account_id: r.payment_account_id as string,
      payment_account_label: acct?.account_display_name ?? acct?.tag ?? null,
      email_address: r.email_address as string,
      connection_status: r.connection_status as string,
      watch_expires_at: r.watch_expires_at as string | null,
      last_synced_at: r.last_synced_at as string | null,
      last_sync_attempt_at: r.last_sync_attempt_at as string | null,
      last_error_message: r.last_error_message as string | null,
      connected_at: r.connected_at as string | null,
    };
  });
}

// ---------------------------------------------------------------------------
// Disconnect a Gmail connection (manager/owner only)
// ---------------------------------------------------------------------------

export async function disconnectGmailConnection(
  connectionId: string,
  userId: string
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("gmail_connections")
    .update({
      connection_status: "disconnected",
      encrypted_access_token: null,
      token_iv: null,
      encrypted_refresh_token: null,
      refresh_iv: null,
      disconnected_by: userId,
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}

// ---------------------------------------------------------------------------
// Mark a needs_review transaction as confirmed or duplicate (manager action)
// ---------------------------------------------------------------------------

export async function reviewTransaction(
  transactionId: string,
  action: "confirm" | "mark_duplicate" | "mark_failed",
  managerId: string,
  shopId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const newStatus =
    action === "confirm"
      ? "confirmed"
      : action === "mark_duplicate"
      ? "duplicate"
      : "failed";

  const isCounted = action === "confirm";

  const { error } = await admin
    .from("payment_transactions")
    .update({
      status: newStatus,
      is_counted: isCounted,
      review_reason: `Reviewed by manager: ${action}`,
    })
    .eq("id", transactionId)
    .eq("shop_id", shopId);

  if (error) return { success: false, error: error.message };

  // Audit log
  await admin.from("payment_audit_logs").insert({
    shop_id: shopId,
    entity_type: "payment_transaction",
    entity_id: transactionId,
    action: `review_${action}`,
    new_values: { status: newStatus, is_counted: isCounted },
    performed_by: managerId,
    performed_at: new Date().toISOString(),
  });

  return { success: true };
}
