// ============================================================================
// Lady E Luck Portal — Gmail History Sync Service (SERVER ONLY)
//
// Called by:
//   - Pub/Sub webhook push handler (new message notification)
//   - Reconciliation/fallback cron job
//   - Manual sync trigger (manager UI)
//
// Flow:
//   1. Load connection + decrypt access token (refresh if expired)
//   2. Call Gmail history.list since last_history_id
//   3. Fetch each new message
//   4. Hand each message to the ingestion service
//   5. Update last_history_id and sync log
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./gmail-crypto";
import { ingestGmailMessage } from "./ingestion-service";

// ---------------------------------------------------------------------------
// Local row types for admin queries (avoids Supabase GenericStringError)
// ---------------------------------------------------------------------------
interface GmailConnectionDbRow {
  id: string;
  shop_id: string;
  email_address: string;
  encrypted_access_token: string | null;
  token_iv: string | null;
  encrypted_refresh_token: string;
  refresh_iv: string;
  token_expires_at: string | null;
  last_history_id: string | null;
  connection_status: string;
}


const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface SyncOptions {
  connectionId: string;
  triggerType: "push_notification" | "reconciliation" | "manual" | "watch_renewal";
  /** If provided, use this historyId as the start instead of stored value */
  startHistoryId?: string;
}

export interface SyncResult {
  outcome: "ok" | "error" | "no_new_messages";
  emailsFound: number;
  emailsProcessed: number;
  recordsCreated: number;
  recordsSkipped: number;
  errorsFound: number;
  errorSummary: string | null;
  newHistoryId: string | null;
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncGmailConnection(opts: SyncOptions): Promise<SyncResult> {
  const admin = createAdminClient();
  const result: SyncResult = {
    outcome: "ok",
    emailsFound: 0,
    emailsProcessed: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    errorsFound: 0,
    errorSummary: null,
    newHistoryId: null,
  };

  // --- Create sync log entry ---
  const { data: syncLog } = await admin
    .from("payment_sync_logs")
    .insert({
      shop_id: "00000000-0000-0000-0000-000000000000", // placeholder; overwritten below
      gmail_connection_id: opts.connectionId,
      sync_type: opts.triggerType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const syncLogId = syncLog?.id;

  try {
    // --- Load connection ---
    const { data: connRaw } = await admin
      .from("gmail_connections")
      .select(
        "id, shop_id, email_address, encrypted_access_token, token_iv, " +
        "encrypted_refresh_token, refresh_iv, token_expires_at, last_history_id, connection_status"
      )
      .eq("id", opts.connectionId)
      .single();
    const conn = connRaw as GmailConnectionDbRow | null;

    if (!conn) throw new Error("connection_not_found");
    if (!conn.encrypted_refresh_token || !conn.refresh_iv) {
      throw new Error("no_refresh_token_stored");
    }

    // Patch the sync log with the real shop_id
    if (syncLogId) {
      await admin
        .from("payment_sync_logs")
        .update({ shop_id: conn.shop_id })
        .eq("id", syncLogId);
    }

    // --- Get a valid access token ---
    const accessToken = await getValidAccessToken(conn, admin);

    // --- Determine start historyId ---
    const startId = opts.startHistoryId ?? conn.last_history_id ?? null;
    if (!startId) {
      // No prior historyId — do a full inbox scan (limited for safety)
      const messages = await fetchRecentMessages(accessToken, conn.email_address, 50);
      result.emailsFound = messages.length;
      for (const msgId of messages) {
        const ir = await ingestGmailMessage({
          gmailMessageId: msgId,
          accessToken,
          gmailEmail: conn.email_address,
          connectionId: conn.id,
          shopId: conn.shop_id,
        });
        result.emailsProcessed++;
        if (ir.outcome === "created") result.recordsCreated++;
        else if (ir.outcome === "duplicate") result.recordsSkipped++;
        else if (ir.outcome === "error") result.errorsFound++;
      }
    } else {
      // Incremental sync via history API
      const { messages, newHistoryId } = await fetchHistorySince(
        accessToken,
        conn.email_address,
        startId
      );
      result.emailsFound = messages.length;
      result.newHistoryId = newHistoryId;

      for (const msgId of messages) {
        const ir = await ingestGmailMessage({
          gmailMessageId: msgId,
          accessToken,
          gmailEmail: conn.email_address,
          connectionId: conn.id,
          shopId: conn.shop_id,
        });
        result.emailsProcessed++;
        if (ir.outcome === "created") result.recordsCreated++;
        else if (ir.outcome === "duplicate") result.recordsSkipped++;
        else if (ir.outcome === "error") result.errorsFound++;
      }

      if (messages.length === 0) {
        result.outcome = "no_new_messages";
      }

      // Update stored historyId
      if (newHistoryId) {
        await admin
          .from("gmail_connections")
          .update({
            last_history_id: newHistoryId,
            last_synced_at: new Date().toISOString(),
            last_sync_attempt_at: new Date().toISOString(),
            connection_status: "connected",
            last_error_code: null,
            last_error_message: null,
          })
          .eq("id", opts.connectionId);
      }
    }

    // --- Update sync log ---
    if (syncLogId) {
      await admin.from("payment_sync_logs").update({
        completed_at: new Date().toISOString(),
        status: "completed",
        emails_found: result.emailsFound,
        emails_processed: result.emailsProcessed,
        records_created: result.recordsCreated,
        records_skipped: result.recordsSkipped,
        errors_found: result.errorsFound,
        error_summary: result.errorSummary,
        history_id_end: result.newHistoryId,
      }).eq("id", syncLogId);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[gmail-sync] ${opts.connectionId} failed:`, msg);

    result.outcome = "error";
    result.errorsFound = 1;
    result.errorSummary = msg.slice(0, 500);

    // Update connection status
    await admin.from("gmail_connections").update({
      connection_status: "error",
      last_error_message: msg.slice(0, 500),
      last_sync_attempt_at: new Date().toISOString(),
    }).eq("id", opts.connectionId);

    if (syncLogId) {
      await admin.from("payment_sync_logs").update({
        completed_at: new Date().toISOString(),
        status: "failed",
        errors_found: 1,
        error_summary: msg.slice(0, 500),
      }).eq("id", syncLogId);
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Get a valid (non-expired) access token; refresh if needed
// ---------------------------------------------------------------------------

async function getValidAccessToken(
  conn: {
    encrypted_access_token: string | null;
    token_iv: string | null;
    encrypted_refresh_token: string;
    refresh_iv: string;
    token_expires_at: string | null;
    id: string;
  },
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  const now = Date.now();
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const bufferMs = 5 * 60 * 1000; // Refresh 5 min before expiry

  if (conn.encrypted_access_token && conn.token_iv && expiresAt > now + bufferMs) {
    try {
      return decryptToken(conn.encrypted_access_token, conn.token_iv);
    } catch {
      // Fall through to refresh
    }
  }

  // Refresh the access token
  const refreshToken = decryptToken(conn.encrypted_refresh_token, conn.refresh_iv);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`token_refresh_failed: ${data.error_description ?? data.error}`);
  }

  const newAccessToken: string = data.access_token;
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  const { ciphertext: encAccess, iv: accessIv } = encryptToken(newAccessToken);

  await admin.from("gmail_connections").update({
    encrypted_access_token: encAccess,
    token_iv: accessIv,
    token_expires_at: newExpiresAt,
  }).eq("id", conn.id);

  return newAccessToken;
}

// ---------------------------------------------------------------------------
// Fetch new messages via Gmail history API
// ---------------------------------------------------------------------------

async function fetchHistorySince(
  accessToken: string,
  email: string,
  startHistoryId: string
): Promise<{ messages: string[]; newHistoryId: string | null }> {
  const url = new URL(`${GMAIL_API}/users/${encodeURIComponent(email)}/history`);
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    // historyId too old — fall back to recent messages
    const msgs = await fetchRecentMessages(accessToken, email, 50);
    return { messages: msgs, newHistoryId: null };
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`history_list_failed: ${data.error?.message ?? res.status}`);
  }

  const newHistoryId: string | null = data.historyId ?? null;
  const messageIds: string[] = [];
  for (const history of data.history ?? []) {
    for (const ma of history.messagesAdded ?? []) {
      if (ma.message?.id) messageIds.push(ma.message.id);
    }
  }

  // Deduplicate
  const unique = [...new Set(messageIds)];
  return { messages: unique, newHistoryId };
}

// ---------------------------------------------------------------------------
// Fallback: fetch recent messages (no historyId yet)
// ---------------------------------------------------------------------------

async function fetchRecentMessages(
  accessToken: string,
  email: string,
  maxResults = 50
): Promise<string[]> {
  const url = new URL(`${GMAIL_API}/users/${encodeURIComponent(email)}/messages`);
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok) return [];

  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

// ---------------------------------------------------------------------------
// Watch renewal: called by cron before watch_expires_at
// ---------------------------------------------------------------------------

export async function renewGmailWatches(): Promise<void> {
  const admin = createAdminClient();

  // Find connections whose watch expires within 24 hours
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: connsRaw } = await admin
    .from("gmail_connections")
    .select(
      "id, shop_id, email_address, encrypted_access_token, token_iv, " +
      "encrypted_refresh_token, refresh_iv, token_expires_at, last_history_id"
    )
    .eq("connection_status", "connected")
    .lte("watch_expires_at", cutoff);
  const conns = connsRaw as GmailConnectionDbRow[] | null;

  if (!conns?.length) return;

  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) return;

  for (const conn of conns) {
    try {
      const accessToken = await getValidAccessToken(conn as Parameters<typeof getValidAccessToken>[0], admin);

      const watchRes = await fetch(
        `${GMAIL_API}/users/${encodeURIComponent(conn.email_address)}/watch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicName,
            labelIds: ["INBOX"],
            labelFilterBehavior: "INCLUDE",
          }),
        }
      );

      const watchData = await watchRes.json();
      if (watchRes.ok && watchData.historyId) {
        await admin.from("gmail_connections").update({
          watch_expires_at: new Date(parseInt(watchData.expiration)).toISOString(),
          last_history_id: String(watchData.historyId),
        }).eq("id", conn.id);

        // Log the renewal
        await admin.from("payment_sync_logs").insert({
          shop_id: conn.shop_id,
          gmail_connection_id: conn.id,
          sync_type: "watch_renewal",
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[watch-renewal] connection ${conn.id} failed:`, err);
    }
  }
}
