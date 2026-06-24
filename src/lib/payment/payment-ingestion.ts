/**
 * Payment email ingestion pipeline.
 * SERVER-ONLY.
 *
 * Orchestrates the full sync flow for a single gmail_connection:
 *   1. Load and validate the access token (refresh if expired)
 *   2. Load the active sender allowlist from the DB
 *   3. List Gmail messages matching known payment sender addresses
 *   4. For each message (up to MAX_SYNC_MESSAGES):
 *      a. Dedup check by Gmail message ID
 *      b. Fetch full message
 *      c. Extract From header, validate sender exactly
 *      d. Extract plain text body, compute body hash
 *      e. Body hash dedup check
 *      f. Parse payment data (Cash App or Chime)
 *      g. Provider transaction ID dedup check (if present)
 *      h. Soft dedup check (amount + direction + time window)
 *      i. Write payment_email_event row
 *      j. Write payment_transaction row (if parseable)
 *   5. Update connection record (last_synced_at, last_error_*)
 *   6. Write payment_sync_logs row
 *
 * A transaction is is_counted=true only when:
 *   - Sender validated (exact match)
 *   - Parser confidence = 1.0 (all required fields found)
 *   - No duplicates detected
 *   - Provider is CashApp (Chime is always review-only)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { storeEncryptedToken, loadEncryptedToken } from "./token-encryption";
import { refreshAccessToken } from "./gmail-oauth";
import { listMessages, getMessage } from "./gmail-client";
import {
  extractPlainText,
  getHeader,
  parseFromAddress,
  hashEmailBody,
} from "./gmail-body";
import { getActiveSenders, validateSender } from "./sender-validation";
import {
  isMessageAlreadyProcessed,
  isDuplicateBodyHash,
  isDuplicateByProviderTransactionId,
  isSoftDuplicate,
} from "./deduplication";
import { parsePaymentEmail } from "./payment-parsers";
import { MAX_SYNC_MESSAGES } from "./rate-limiter";

export interface SyncResult {
  connectionId: string;
  emailsFound: number;
  emailsProcessed: number;
  recordsCreated: number;
  recordsSkipped: number;
  errorsFound: number;
  errorSummary: string | null;
}

interface GmailConnectionRow {
  id: string;
  shop_id: string;
  payment_account_id: string;
  email_address: string;
  encrypted_access_token: string | null;
  token_iv: string | null;
  encrypted_refresh_token: string | null;
  refresh_iv: string | null;
  token_expires_at: string | null;
  connection_status: string;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function getValidAccessToken(
  conn: GmailConnectionRow
): Promise<string> {
  if (
    !conn.encrypted_access_token ||
    !conn.token_iv
  ) {
    throw new Error("Connection has no stored access token");
  }

  const admin = createAdminClient();
  const now = new Date();
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt <= now;

  if (needsRefresh) {
    if (!conn.encrypted_refresh_token || !conn.refresh_iv) {
      throw new Error("Access token expired and no refresh token available");
    }

    const refreshToken = loadEncryptedToken(
      conn.refresh_iv,
      conn.encrypted_refresh_token
    );

    const refreshed = await refreshAccessToken(refreshToken);

    // Store the new access token
    const { iv, tagAndData } = storeEncryptedToken(refreshed.access_token);
    const newExpiry = new Date(
      Date.now() + (refreshed.expires_in - 60) * 1000 // subtract 60s buffer
    ).toISOString();

    await admin
      .from("gmail_connections")
      .update({
        encrypted_access_token: tagAndData,
        token_iv: iv,
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conn.id);

    return refreshed.access_token;
  }

  return loadEncryptedToken(conn.token_iv, conn.encrypted_access_token);
}

// ---------------------------------------------------------------------------
// Main ingestion entry point
// ---------------------------------------------------------------------------

/**
 * Run a full Gmail sync for the given connection.
 * This function is idempotent: repeated calls for the same messages are safe.
 *
 * @param connectionId — UUID of the gmail_connections row to sync
 * @param triggeredBy  — user ID who triggered the sync (for audit logging)
 */
export async function syncGmailConnection(
  connectionId: string,
  triggeredBy: string
): Promise<SyncResult> {
  const admin = createAdminClient();
  const startedAt = new Date().toISOString();

  const result: SyncResult = {
    connectionId,
    emailsFound: 0,
    emailsProcessed: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    errorsFound: 0,
    errorSummary: null,
  };

  // --- Load the connection ---
  const { data: connData, error: connErr } = await admin
    .from("gmail_connections")
    .select(
      "id, shop_id, payment_account_id, email_address, encrypted_access_token, " +
      "token_iv, encrypted_refresh_token, refresh_iv, token_expires_at, connection_status"
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (connErr || !connData) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const conn = connData as unknown as GmailConnectionRow;

  // Mark sync attempt immediately
  await admin
    .from("gmail_connections")
    .update({
      last_sync_attempt_at: startedAt,
      connection_status: "connected",
      updated_at: startedAt,
    })
    .eq("id", connectionId);

  let syncLogId: string | null = null;

  try {
    // --- Create sync log row ---
    const { data: syncLog } = await admin
      .from("payment_sync_logs")
      .insert({
        shop_id: conn.shop_id,
        gmail_connection_id: connectionId,
        sync_type: "manual",
        started_at: startedAt,
        status: "running",
      })
      .select("id")
      .single();

    syncLogId = (syncLog as { id: string } | null)?.id ?? null;

    // --- Get valid access token ---
    const accessToken = await getValidAccessToken(conn);

    // --- Load active senders ---
    const activeSenders = await getActiveSenders();

    if (activeSenders.length === 0) {
      // No active senders — nothing to search for
      result.errorSummary = "No active verified senders configured";
      await finalizeSync(admin, connectionId, syncLogId, result, startedAt, "completed");
      return result;
    }

    // --- Build search query from active sender addresses ---
    const senderQuery = activeSenders
      .map((s) => `from:${s.normalized_sender_email}`)
      .join(" OR ");

    // --- List messages ---
    const listResult = await listMessages(accessToken, senderQuery, MAX_SYNC_MESSAGES);
    const messageRefs = listResult.messages ?? [];
    result.emailsFound = messageRefs.length;

    const errors: string[] = [];

    // --- Process each message ---
    for (const ref of messageRefs) {
      try {
        await processOneMessage(
          admin,
          conn,
          accessToken,
          activeSenders,
          ref.id,
          result
        );
      } catch (msgErr) {
        result.errorsFound++;
        const msg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        errors.push(`${ref.id}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      result.errorSummary = errors.slice(0, 5).join("; ");
    }

    await finalizeSync(admin, connectionId, syncLogId, result, startedAt, "completed");
    return result;
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    result.errorsFound++;
    result.errorSummary = msg;

    await admin
      .from("gmail_connections")
      .update({
        connection_status: "error",
        last_error_message: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    await finalizeSync(admin, connectionId, syncLogId, result, startedAt, "failed");
    throw fatalErr;
  }
}

// ---------------------------------------------------------------------------
// Process a single Gmail message
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

async function processOneMessage(
  admin: AdminClient,
  conn: GmailConnectionRow,
  accessToken: string,
  activeSenders: Awaited<ReturnType<typeof getActiveSenders>>,
  messageId: string,
  result: SyncResult
): Promise<void> {
  result.emailsProcessed++;

  // --- Dedup by Gmail message ID ---
  if (await isMessageAlreadyProcessed(messageId)) {
    result.recordsSkipped++;
    return;
  }

  // --- Fetch full message ---
  const msg = await getMessage(accessToken, messageId);
  const payload = msg.payload;
  if (!payload) {
    result.recordsSkipped++;
    return;
  }

  // --- Extract headers ---
  const fromHeader = getHeader(payload, "From") ?? "";
  const subject = getHeader(payload, "Subject") ?? "";
  const dateHeader = getHeader(payload, "Date");

  const fromAddress = parseFromAddress(fromHeader);

  // --- Validate sender (exact match only) ---
  const matchedSender = validateSender(fromAddress, activeSenders);
  const senderAllowed = matchedSender !== null;

  // --- Extract body and compute hash ---
  const bodyText = extractPlainText(payload);
  const bodyHash = bodyText.length > 0 ? hashEmailBody(bodyText) : null;

  // --- Parse the received timestamp ---
  let emailReceivedAt: Date;
  if (msg.internalDate) {
    emailReceivedAt = new Date(parseInt(msg.internalDate, 10));
  } else if (dateHeader) {
    emailReceivedAt = new Date(dateHeader);
  } else {
    emailReceivedAt = new Date();
  }

  // --- Body hash dedup ---
  if (bodyHash && (await isDuplicateBodyHash(conn.shop_id, bodyHash))) {
    // Record the event as a duplicate so we don't reprocess
    await admin.from("payment_email_events").insert({
      gmail_connection_id: conn.id,
      shop_id: conn.shop_id,
      payment_account_id: conn.payment_account_id,
      gmail_message_id: messageId,
      gmail_thread_id: msg.threadId,
      sender_email: fromAddress,
      normalized_sender_email: fromAddress,
      subject,
      email_received_at: emailReceivedAt.toISOString(),
      sender_allowed: senderAllowed,
      parse_status: "duplicate",
      body_hash: bodyHash,
      processed_at: new Date().toISOString(),
    });
    result.recordsSkipped++;
    return;
  }

  // --- If sender not allowed, record rejection and stop ---
  if (!senderAllowed) {
    await admin.from("payment_email_events").insert({
      gmail_connection_id: conn.id,
      shop_id: conn.shop_id,
      payment_account_id: conn.payment_account_id,
      gmail_message_id: messageId,
      gmail_thread_id: msg.threadId,
      sender_email: fromAddress,
      normalized_sender_email: fromAddress,
      subject,
      email_received_at: emailReceivedAt.toISOString(),
      sender_allowed: false,
      parse_status: "rejected",
      rejection_reason: "sender_not_in_allowlist",
      body_hash: bodyHash,
      processed_at: new Date().toISOString(),
    });
    result.recordsSkipped++;
    return;
  }

  // --- Parse payment data ---
  const parsed = parsePaymentEmail(
    matchedSender.provider,
    subject,
    bodyText,
    emailReceivedAt
  );

  if (!parsed) {
    await admin.from("payment_email_events").insert({
      gmail_connection_id: conn.id,
      shop_id: conn.shop_id,
      payment_account_id: conn.payment_account_id,
      gmail_message_id: messageId,
      gmail_thread_id: msg.threadId,
      sender_email: fromAddress,
      normalized_sender_email: fromAddress,
      subject,
      email_received_at: emailReceivedAt.toISOString(),
      sender_allowed: true,
      parse_status: "parse_failed",
      rejection_reason: "no_parser_match",
      body_hash: bodyHash,
      processed_at: new Date().toISOString(),
    });
    result.recordsSkipped++;
    return;
  }

  // --- Provider transaction ID dedup ---
  if (parsed.providerTransactionId) {
    const isDup = await isDuplicateByProviderTransactionId(
      conn.shop_id,
      parsed.provider,
      parsed.providerTransactionId
    );
    if (isDup) {
      await admin.from("payment_email_events").insert({
        gmail_connection_id: conn.id,
        shop_id: conn.shop_id,
        payment_account_id: conn.payment_account_id,
        gmail_message_id: messageId,
        gmail_thread_id: msg.threadId,
        sender_email: fromAddress,
        normalized_sender_email: fromAddress,
        subject,
        email_received_at: emailReceivedAt.toISOString(),
        sender_allowed: true,
        parse_status: "duplicate",
        rejection_reason: "duplicate_provider_transaction_id",
        body_hash: bodyHash,
        processed_at: new Date().toISOString(),
      });
      result.recordsSkipped++;
      return;
    }
  }

  // --- Soft dedup (amount + direction + time window) ---
  const softDup = await isSoftDuplicate({
    shopId: conn.shop_id,
    paymentAccountId: conn.payment_account_id,
    provider: parsed.provider,
    direction: parsed.direction,
    amount: parsed.amount,
    occurredAt: parsed.occurredAt,
  });

  if (softDup) {
    await admin.from("payment_email_events").insert({
      gmail_connection_id: conn.id,
      shop_id: conn.shop_id,
      payment_account_id: conn.payment_account_id,
      gmail_message_id: messageId,
      gmail_thread_id: msg.threadId,
      sender_email: fromAddress,
      normalized_sender_email: fromAddress,
      subject,
      email_received_at: emailReceivedAt.toISOString(),
      sender_allowed: true,
      parse_status: "duplicate",
      rejection_reason: "soft_duplicate_amount_direction_time",
      body_hash: bodyHash,
      processed_at: new Date().toISOString(),
    });
    result.recordsSkipped++;
    return;
  }

  // --- Write email event row ---
  const isHighConfidence = parsed.confidence >= 1.0;
  const parseStatus = isHighConfidence ? "parsed" : "parsed";
  // (even partial parses are 'parsed'; the transaction status handles review)

  const { data: eventData } = await admin
    .from("payment_email_events")
    .insert({
      gmail_connection_id: conn.id,
      shop_id: conn.shop_id,
      payment_account_id: conn.payment_account_id,
      gmail_message_id: messageId,
      gmail_thread_id: msg.threadId,
      sender_email: fromAddress,
      normalized_sender_email: fromAddress,
      subject,
      email_received_at: emailReceivedAt.toISOString(),
      sender_allowed: true,
      authentication_status: "pass",
      parse_status: parseStatus,
      body_hash: bodyHash,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const emailEventId = (eventData as { id: string } | null)?.id ?? null;

  // --- Determine transaction status and is_counted ---
  // is_counted=true only when:
  //   - Confidence = 1.0 (all required fields)
  //   - Provider is CashApp (Chime is always review-only)
  //   - Amount > 0
  const isCounted =
    isHighConfidence &&
    parsed.provider === "CashApp" &&
    parsed.amount > 0;

  const txStatus = isCounted ? "confirmed" : "needs_review";
  const reviewReason = isCounted
    ? null
    : parsed.provider === "Chime"
    ? "chime_review_only"
    : "low_parser_confidence";

  // --- Write transaction row ---
  await admin.from("payment_transactions").insert({
    shop_id: conn.shop_id,
    payment_account_id: conn.payment_account_id,
    email_event_id: emailEventId,
    provider: parsed.provider,
    provider_transaction_id: parsed.providerTransactionId,
    direction: parsed.direction,
    activity_type: parsed.activityType,
    amount: parsed.amount,
    customer_name: parsed.customerName,
    customer_payment_tag: parsed.customerTag,
    normalized_customer_payment_tag: parsed.normalizedCustomerTag,
    status: txStatus,
    is_counted: isCounted,
    confidence: parsed.confidence,
    occurred_at: parsed.occurredAt.toISOString(),
    review_reason: reviewReason,
    payment_note: parsed.paymentNote,
  });

  result.recordsCreated++;
}

// ---------------------------------------------------------------------------
// Finalize sync
// ---------------------------------------------------------------------------

async function finalizeSync(
  admin: AdminClient,
  connectionId: string,
  syncLogId: string | null,
  result: SyncResult,
  startedAt: string,
  status: "completed" | "failed"
): Promise<void> {
  const now = new Date().toISOString();

  // Update connection
  await admin
    .from("gmail_connections")
    .update({
      last_synced_at: now,
      updated_at: now,
    })
    .eq("id", connectionId);

  // Update sync log
  if (syncLogId) {
    await admin
      .from("payment_sync_logs")
      .update({
        completed_at: now,
        status,
        emails_found: result.emailsFound,
        emails_processed: result.emailsProcessed,
        records_created: result.recordsCreated,
        records_skipped: result.recordsSkipped,
        errors_found: result.errorsFound,
        error_summary: result.errorSummary,
      })
      .eq("id", syncLogId);
  }
}