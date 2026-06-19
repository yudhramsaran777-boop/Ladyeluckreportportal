// ============================================================================
// Lady E Luck Portal - Payment Server Query Helper
// Phase 3: Employee individual-payment server responses
//
// SECURITY RULES (enforced here, not just in RLS):
//   - shop_id is ALWAYS the caller-supplied value derived server-side from the
//     authenticated user's profile. It is NEVER read from client input.
//   - The returned EmployeePaymentTransaction[] shape contains NO aggregate
//     totals, NO token fields, NO oauth credentials.
//   - RLS on payment_transactions acts as a secondary safety net:
//     employees only see is_counted=true + status in ('confirmed','pending')
//     rows for their own shop.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type { EmployeePaymentTransaction, RechargeStatus } from "./payment-types";

// ---------------------------------------------------------------------------
// Public params interface
// ---------------------------------------------------------------------------

export interface GetTransactionsParams {
  /** Maximum rows to return (capped at 50 internally). Default: 20. */
  limit?: number;
  /** Cursor for keyset pagination - ISO occurred_at of the last seen row. */
  cursor?: string | null;
  provider?: "CashApp" | "Chime" | null;
  direction?: "received" | "sent" | null;
  playerMatch?: "matched" | "unmatched" | "needs_review" | null;
  /** true = only recharged transactions; false = only un-recharged; null = all */
  recharged?: boolean | null;
  /** Partial match against normalized_customer_payment_tag */
  searchTag?: string | null;
  /** Partial match against player_name or customer_name (post-join) */
  searchPlayer?: string | null;
  /** ISO date string (YYYY-MM-DD). Inclusive lower bound on occurred_at. */
  dateStart?: string | null;
  /** ISO date string (YYYY-MM-DD). Inclusive upper bound on occurred_at. */
  dateEnd?: string | null;
}

export interface GetTransactionsResult {
  data: EmployeePaymentTransaction[];
  /** True if there are more rows beyond this page (caller may fetch with cursor). */
  hasMore: boolean;
  /** The next cursor to pass for the following page (last item's occurred_at). */
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Internal DB row types (only the columns we SELECT)
// ---------------------------------------------------------------------------

interface TxnRow {
  id: string;
  occurred_at: string;
  provider: string;
  direction: string;
  amount: string | number;
  customer_payment_tag: string | null;
  normalized_customer_payment_tag: string | null;
  customer_name: string | null;
  player_match_status: string;
  status: string;
  is_counted: boolean;
  payment_account_id: string | null;
}

interface AccountRow {
  id: string;
  account_display_name: string | null;
  tag: string | null;
}

interface MappingRow {
  id: string;
  provider: string;
  normalized_payment_tag: string;
  player_name: string | null;
  game_username: string | null;
  verification_status: string;
}

interface RechargeRow {
  id: string;
  payment_transaction_id: string;
  recharge_status: string;
  bonus_given: string | number;
  missing_recharge: string | number;
  voided_at: string | null;
}

// ---------------------------------------------------------------------------
// Map DB recharge_status values to the TypeScript RechargeStatus enum
// DB uses: 'exact' | 'bonus_given' | 'missing_recharge' | 'voided'
// TS uses: 'completed_no_bonus' | 'completed_with_bonus' | 'under_recharged' | 'voided' | 'needs_review'
// ---------------------------------------------------------------------------

function mapRechargeStatus(dbStatus: string | null | undefined): RechargeStatus | null {
  if (!dbStatus) return null;
  switch (dbStatus) {
    case "bonus_given":      return "completed_with_bonus";
    case "exact":            return "completed_no_bonus";
    case "missing_recharge": return "under_recharged";
    case "voided":           return "voided";
    default:                 return "needs_review";
  }
}

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

export async function getEmployeeTransactions(
  shopId: string,
  params: GetTransactionsParams = {}
): Promise<GetTransactionsResult> {
  const {
    limit = 20,
    cursor,
    provider,
    direction,
    playerMatch,
    recharged,
    searchTag,
    searchPlayer,
    dateStart,
    dateEnd,
  } = params;

  const safeLimit = Math.min(Math.max(1, limit), 50);
  const supabase = createClient();

  // ---- Step 1: fetch transaction rows ------------------------------------
  // Fetch one extra to detect hasMore without a separate COUNT query.
  // RLS enforces shop isolation as a secondary guard.
  // .returns<TxnRow[]>() is called at await-time (after all filters) so it
  // annotates a PostgrestFilterBuilder, not a PostgrestTransformBuilder.
  let query = supabase
    .from("payment_transactions")
    .select(
      "id, occurred_at, provider, direction, amount, " +
      "customer_payment_tag, normalized_customer_payment_tag, customer_name, " +
      "player_match_status, status, is_counted, payment_account_id"
    )
    .eq("shop_id", shopId)
    .eq("is_counted", true)
    .in("status", ["confirmed", "pending"])
    .order("occurred_at", { ascending: false })
    .limit(safeLimit + 1);

  // Keyset pagination - older items have smaller occurred_at
  if (cursor) {
    query = query.lt("occurred_at", cursor);
  }

  // Provider filter
  if (provider) {
    query = query.eq("provider", provider);
  }

  // Direction filter
  if (direction) {
    query = query.eq("direction", direction);
  }

  // Player match filter
  if (playerMatch) {
    query = query.eq("player_match_status", playerMatch);
  }

  // Date range (transactions use timestamptz; dateStart/dateEnd are YYYY-MM-DD)
  if (dateStart) {
    query = query.gte("occurred_at", `${dateStart}T00:00:00.000Z`);
  }
  if (dateEnd) {
    query = query.lte("occurred_at", `${dateEnd}T23:59:59.999Z`);
  }

  // Tag search against normalized tag column
  if (searchTag) {
    const normalized = searchTag.toLowerCase().replace(/[$\s_\-]/g, "");
    if (normalized.length > 0) {
      query = query.ilike("normalized_customer_payment_tag", `%${normalized}%`);
    }
  }

  // .returns<TxnRow[]>() placed here - after all filters are applied
  const { data: transactionRows, error: transactionError } = await query.returns<TxnRow[]>();

  if (transactionError) {
    console.error("[payment-server] transactions query error:", transactionError.message);
    return { data: [], hasMore: false, nextCursor: null };
  }

  const rawTxns: TxnRow[] = transactionRows ?? [];
  const hasMore = rawTxns.length > safeLimit;
  const txns = hasMore ? rawTxns.slice(0, safeLimit) : rawTxns;

  if (txns.length === 0) {
    return { data: [], hasMore: false, nextCursor: null };
  }

  // ---- Step 2: batch-fetch related data ---------------------------------

  const accountIds = [
    ...new Set(txns.map((t) => t.payment_account_id).filter((id): id is string => Boolean(id))),
  ];
  const normalizedTags = [
    ...new Set(
      txns.map((t) => t.normalized_customer_payment_tag).filter((tag): tag is string => Boolean(tag))
    ),
  ];
  const txnIds = txns.map((t) => t.id);

  const [accountsRes, mappingsRes, rechargesRes] = await Promise.all([
    accountIds.length > 0
      ? supabase
          .from("payment_accounts")
          .select("id, account_display_name, tag")
          .in("id", accountIds)
      : Promise.resolve({ data: [] as AccountRow[], error: null }),
    normalizedTags.length > 0
      ? supabase
          .from("player_payment_tags")
          .select("id, provider, normalized_payment_tag, player_name, game_username, verification_status")
          .eq("shop_id", shopId)
          .in("normalized_payment_tag", normalizedTags)
      : Promise.resolve({ data: [] as MappingRow[], error: null }),
    supabase
      .from("payment_recharges")
      .select("id, payment_transaction_id, recharge_status, bonus_given, missing_recharge, voided_at")
      .in("payment_transaction_id", txnIds)
      .is("voided_at", null),
  ]);

  // Build lookup maps
  const accountMap = new Map<string, AccountRow>(
    ((accountsRes.data || []) as AccountRow[]).map((a) => [a.id, a])
  );

  // Mapping key = "provider:normalized_tag" - unique per shop (enforced by DB unique constraint)
  const mappingMap = new Map<string, MappingRow>(
    ((mappingsRes.data || []) as MappingRow[]).map((m) => [
      `${m.provider}:${m.normalized_payment_tag}`,
      m,
    ])
  );

  const rechargeMap = new Map<string, RechargeRow>(
    ((rechargesRes.data || []) as RechargeRow[]).map((r) => [r.payment_transaction_id, r])
  );

  // ---- Step 3: assemble EmployeePaymentTransaction[] --------------------

  let assembled: EmployeePaymentTransaction[] = txns.map((txn) => {
    const account = txn.payment_account_id ? accountMap.get(txn.payment_account_id) ?? null : null;
    const mappingKey = txn.normalized_customer_payment_tag
      ? `${txn.provider}:${txn.normalized_customer_payment_tag}`
      : null;
    const mapping = mappingKey ? mappingMap.get(mappingKey) ?? null : null;
    const recharge = rechargeMap.get(txn.id) ?? null;

    const isConfirmedReceived = txn.status === "confirmed" && txn.direction === "received";
    const hasActiveMapping =
      mapping !== null &&
      ["employee_added", "manager_verified"].includes(mapping.verification_status);
    const isMatched =
      txn.player_match_status === "matched" || hasActiveMapping;

    // can_add_player: confirmed received, no match yet
    const can_add_player = isConfirmedReceived && txn.player_match_status === "unmatched";

    // can_recharge: confirmed received, player identified, not yet recharged
    const can_recharge = isConfirmedReceived && isMatched && recharge === null;

    // Strict shape - only the fields defined in EmployeePaymentTransaction
    return {
      id: txn.id,
      occurred_at: txn.occurred_at,
      provider: txn.provider as EmployeePaymentTransaction["provider"],
      payment_account_name:
        account?.account_display_name || account?.tag || "Payment Account",
      business_payment_tag: account?.tag ?? null,
      direction: txn.direction as EmployeePaymentTransaction["direction"],
      individual_amount: Number(txn.amount),
      customer_payment_tag: txn.customer_payment_tag ?? null,
      customer_name: txn.customer_name ?? null,
      player_name: mapping?.player_name ?? null,
      game_username: mapping?.game_username ?? null,
      transaction_status: txn.status as EmployeePaymentTransaction["transaction_status"],
      player_match_status: txn.player_match_status as EmployeePaymentTransaction["player_match_status"],
      recharge_status: recharge ? mapRechargeStatus(recharge.recharge_status) : null,
      specific_recharge_bonus: recharge ? Number(recharge.bonus_given) : null,
      specific_missing_recharge: recharge ? Number(recharge.missing_recharge) : null,
      can_add_player,
      can_recharge,
      player_mapping_id: mapping?.id ?? null,
      recharge_id: recharge?.id ?? null,
    };
  });

  // ---- Step 4: post-join filters (can't push to DB without complex joins) -

  // Player name / customer name search
  if (searchPlayer && searchPlayer.trim().length > 0) {
    const needle = searchPlayer.trim().toLowerCase();
    assembled = assembled.filter(
      (t) =>
        t.player_name?.toLowerCase().includes(needle) ||
        t.customer_name?.toLowerCase().includes(needle)
    );
  }

  // Recharged filter
  if (recharged === true) {
    assembled = assembled.filter((t) => t.recharge_status !== null);
  } else if (recharged === false) {
    assembled = assembled.filter((t) => t.recharge_status === null);
  }

  const nextCursor = hasMore && txns.length > 0 ? txns[txns.length - 1].occurred_at : null;

  return { data: assembled, hasMore, nextCursor };
}
