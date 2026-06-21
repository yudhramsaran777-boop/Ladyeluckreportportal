// ============================================================================
// Lady E Luck Portal — Payment Ingestion Service (SERVER ONLY)
//
// Processes a single Gmail message end-to-end:
//   1. Check idempotency (gmail_message_id unique constraint)
//   2. Fetch message from Gmail API
//   3. Verify sender allowlist + SPF/DKIM hint
//   4. Route to parser by provider
//   5. Insert payment_email_events record
//   6. Insert payment_transactions record (if parseable)
//   7. Attempt player tag matching
//
// All DB writes use the admin client (service-role). No RLS bypass is needed
// for ingestion — these writes are server-only machine operations.
// ============================================================================

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCashAppNotification } from "./parsers/cashapp-parser";
import { parseChimeNotification } from "./parsers/chime-parser";
import { normalizePaymentTag, normalizeSenderEmail, ALLOWED_SENDERS } from "./parsers/normalize";
import type { IngestionResult } from "./payment-types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const PARSER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface IngestOptions {
  gmailMessageId: string;
  accessToken: string;
  gmailEmail: string;
  connectionId: string;
  shopId: string;
}

export async function ingestGmailMessage(opts: IngestOptions): Promise<IngestionResult> {
  const admin = createAdminClient();
  const { gmailMessageId, accessToken, gmailEmail, connectionId, shopId } = opts;

  // --- 1. Idempotency check ---
  const { data: existing } = await admin
    .from("payment_email_events")
    .select("id, parse_status")
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();

  if (existing) {
    return { gmail_message_id: gmailMessageId, outcome: "duplicate" };
  }

  // --- 2. Fetch message from Gmail API ---
  let rawMessage: GmailMessage;
  try {
    rawMessage = await fetchGmailMessage(accessToken, gmailEmail, gmailMessageId);
  } catch (err) {
    await insertEmailEvent(admin, {
      gmail_message_id: gmailMessageId,
      gmail_thread_id: null,
      connection_id: connectionId,
      shop_id: shopId,
      sender_email: null,
      normalized_sender: null,
      subject: null,
      received_at: null,
      sender_allowed: false,
      authentication_status: "unknown",
      parse_status: "parse_failed",
      rejection_reason: `fetch_failed: ${String(err).slice(0, 200)}`,
      body_hash: null,
    });
    return {
      gmail_message_id: gmailMessageId,
      outcome: "error",
      reason: "fetch_failed",
    };
  }

  const { senderEmail, subject, textBody, receivedAt, threadId, authStatus } =
    extractMessageParts(rawMessage);

  const normalizedSender = senderEmail ? normalizeSenderEmail(senderEmail) : null;
  const senderAllowed = isAllowedSender(normalizedSender);
  const provider = senderAllowed ? getProvider(normalizedSender!) : null;

  // --- 3. Sender not in allowlist → log and reject ---
  if (!senderAllowed || !provider) {
    await insertEmailEvent(admin, {
      gmail_message_id: gmailMessageId,
      gmail_thread_id: threadId,
      connection_id: connectionId,
      shop_id: shopId,
      sender_email: senderEmail,
      normalized_sender: normalizedSender,
      subject,
      received_at: receivedAt,
      sender_allowed: false,
      authentication_status: authStatus,
      parse_status: "rejected",
      rejection_reason: "sender_not_in_allowlist",
      body_hash: textBody ? hashBody(textBody) : null,
    });
    return { gmail_message_id: gmailMessageId, outcome: "rejected", reason: "unknown_sender" };
  }

  // --- 4. Parse the email ---
  const parseInput = { textBody: textBody ?? "", subject: subject ?? "", receivedAt };
  const parsed =
    provider === "CashApp"
      ? parseCashAppNotification(parseInput)
      : parseChimeNotification(parseInput);

  const bodyHash = textBody ? hashBody(textBody) : null;

  // --- 5. Insert payment_email_events ---
  const { data: emailEvent } = await insertEmailEvent(admin, {
    gmail_message_id: gmailMessageId,
    gmail_thread_id: threadId,
    connection_id: connectionId,
    shop_id: shopId,
    sender_email: senderEmail,
    normalized_sender: normalizedSender,
    subject,
    received_at: receivedAt,
    sender_allowed: true,
    authentication_status: authStatus,
    parse_status: parsed.status === "needs_review" ? "parsed" : "parsed",
    rejection_reason: null,
    body_hash: bodyHash,
  });

  const emailEventId = emailEvent?.id ?? null;

  // --- 6. Insert payment_transaction ---
  if (parsed.amount === null && parsed.status !== "needs_review") {
    // Cannot store a transaction without an amount unless it's explicitly needs_review
    return { gmail_message_id: gmailMessageId, outcome: "needs_review" };
  }

  // Look up payment_account_id from the connection
  const { data: conn } = await admin
    .from("gmail_connections")
    .select("payment_account_id")
    .eq("id", connectionId)
    .single();

  const paymentAccountId = conn?.payment_account_id ?? null;

  // Determine our account identifier from the payment_account
  let ourTag: string | null = null;
  if (paymentAccountId) {
    const { data: acct } = await admin
      .from("payment_accounts")
      .select("tag, account_display_name")
      .eq("id", paymentAccountId)
      .single();
    ourTag = acct?.tag ?? acct?.account_display_name ?? null;
  }

  const normalizedCounterpartyTag = normalizePaymentTag(parsed.counterparty_tag);

  // Determine if this transaction counts toward financial totals
  const isCounted =
    parsed.status === "confirmed" &&
    (parsed.activity_type === "incoming" || parsed.activity_type === "outgoing");

  // Map activity_type to direction for backward compat
  const direction =
    parsed.activity_type === "incoming"
      ? "received"
      : parsed.activity_type === "outgoing"
      ? "sent"
      : parsed.activity_type === "refunded"
      ? "received" // refunds come back to us
      : "received"; // default

  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .insert({
      shop_id: shopId,
      payment_account_id: paymentAccountId,
      email_event_id: emailEventId,
      provider: parsed.provider,
      provider_transaction_id: parsed.provider_transaction_id,
      direction,
      activity_type: parsed.activity_type,
      amount: parsed.amount ?? 0,
      customer_name: parsed.counterparty_name,
      customer_payment_tag: parsed.counterparty_tag,
      normalized_customer_payment_tag: normalizedCounterpartyTag,
      payment_note: parsed.payment_note,
      status: parsed.status === "needs_review" ? "needs_review" : parsed.status,
      is_counted: isCounted,
      occurred_at: parsed.occurred_at ?? receivedAt ?? new Date().toISOString(),
      player_match_status: "unmatched",
      review_reason: parsed.parse_notes,
    })
    .select("id")
    .single();

  if (txnError) {
    console.error("[ingestion] transaction insert failed:", txnError.message);
    return {
      gmail_message_id: gmailMessageId,
      outcome: "error",
      reason: txnError.message,
    };
  }

  const transactionId = txn?.id;

  // --- 7. Auto-match player tag ---
  if (transactionId && normalizedCounterpartyTag && parsed.provider) {
    await attemptPlayerTagMatch(admin, {
      transactionId,
      shopId,
      provider: parsed.provider,
      normalizedTag: normalizedCounterpartyTag,
    });
  }

  return {
    gmail_message_id: gmailMessageId,
    outcome: parsed.status === "needs_review" ? "needs_review" : "created",
    transaction_id: transactionId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GmailMessage {
  id: string;
  threadId?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
  };
  internalDate?: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

async function fetchGmailMessage(
  accessToken: string,
  email: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API}/users/${encodeURIComponent(email)}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`gmail_fetch_${res.status}: ${err.error?.message ?? res.statusText}`);
  }
  return res.json();
}

function extractMessageParts(msg: GmailMessage): {
  senderEmail: string | null;
  subject: string | null;
  textBody: string | null;
  receivedAt: string | null;
  threadId: string | null;
  authStatus: "pass" | "fail" | "unknown";
} {
  const headers: Record<string, string> = {};
  for (const h of msg.payload?.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const senderRaw = headers["from"] ?? null;
  const senderEmail = senderRaw ? extractEmail(senderRaw) : null;
  const subject = headers["subject"] ?? null;

  // Parse received-at from internalDate (epoch ms)
  const receivedAt = msg.internalDate
    ? new Date(parseInt(msg.internalDate)).toISOString()
    : null;

  // Extract plain text body
  const textBody = extractTextBody(msg.payload ?? null);

  // Check Authentication-Results header for SPF/DKIM pass
  const authResults = headers["authentication-results"] ?? "";
  const authStatus: "pass" | "fail" | "unknown" = authResults
    ? authResults.includes("dkim=pass") || authResults.includes("spf=pass")
      ? "pass"
      : "fail"
    : "unknown";

  return {
    senderEmail,
    subject,
    textBody,
    receivedAt,
    threadId: msg.threadId ?? null,
    authStatus,
  };
}

function extractEmail(from: string): string {
  // "Name <email@example.com>" or "email@example.com"
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

function extractTextBody(payload: GmailMessage["payload"] | null): string | null {
  if (!payload) return null;

  // Direct body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  // Recurse through parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
    }
    // Try HTML if no text/plain found
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64url").toString("utf8");
        return stripHtml(html);
      }
      if (part.parts) {
        for (const inner of part.parts) {
          if (inner.mimeType === "text/plain" && inner.body?.data) {
            return Buffer.from(inner.body.data, "base64url").toString("utf8");
          }
        }
      }
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedSender(normalized: string | null): boolean {
  if (!normalized) return false;
  return (
    normalized === ALLOWED_SENDERS.CASHAPP || normalized === ALLOWED_SENDERS.CHIME
  );
}

function getProvider(normalizedSender: string): "CashApp" | "Chime" | null {
  if (normalizedSender === ALLOWED_SENDERS.CASHAPP) return "CashApp";
  if (normalizedSender === ALLOWED_SENDERS.CHIME) return "Chime";
  return null;
}

function hashBody(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

async function insertEmailEvent(
  admin: ReturnType<typeof createAdminClient>,
  fields: {
    gmail_message_id: string;
    gmail_thread_id: string | null;
    connection_id: string | null;
    shop_id: string;
    sender_email: string | null;
    normalized_sender: string | null;
    subject: string | null;
    received_at: string | null;
    sender_allowed: boolean;
    authentication_status: string;
    parse_status: string;
    rejection_reason: string | null;
    body_hash: string | null;
  }
) {
  return admin
    .from("payment_email_events")
    .insert({
      gmail_message_id: fields.gmail_message_id,
      gmail_thread_id: fields.gmail_thread_id,
      gmail_connection_id: fields.connection_id,
      shop_id: fields.shop_id,
      sender_email: fields.sender_email,
      normalized_sender_email: fields.normalized_sender,
      subject: fields.subject,
      email_received_at: fields.received_at,
      sender_allowed: fields.sender_allowed,
      authentication_status: fields.authentication_status,
      parse_status: fields.parse_status,
      rejection_reason: fields.rejection_reason,
      body_hash: fields.body_hash,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
}

async function attemptPlayerTagMatch(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    transactionId: string;
    shopId: string;
    provider: "CashApp" | "Chime";
    normalizedTag: string;
  }
) {
  const { transactionId, shopId, provider, normalizedTag } = opts;

  const { data: mapping } = await admin
    .from("player_payment_tags")
    .select("id, verification_status")
    .eq("shop_id", shopId)
    .eq("provider", provider)
    .eq("normalized_payment_tag", normalizedTag)
    .eq("status", "active")
    .maybeSingle();

  if (!mapping) return;

  const matchStatus =
    mapping.verification_status === "manager_verified" ? "matched" : "matched";

  await admin
    .from("payment_transactions")
    .update({
      player_match_status: matchStatus,
      player_mapping_id: mapping.id,
    })
    .eq("id", transactionId);
}
