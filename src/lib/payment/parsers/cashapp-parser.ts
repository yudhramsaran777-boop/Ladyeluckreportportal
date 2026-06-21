// ============================================================================
// Lady E Luck Portal — Cash App Email Parser
//
// Parses sanitized text/plain or HTML-derived text from Cash App notification
// emails sent by cash@square.com.
//
// IMPORTANT: Regex patterns here are best-effort stubs based on typical
// Cash App notification formats. They MUST be reviewed against real sanitized
// email samples before going live. Unknown formats are routed to needs_review.
// Never silently classify an unknown format as confirmed.
// ============================================================================

import type { ParsedPaymentEmail, ActivityType, TransactionStatus } from "../payment-types";
import {
  parseDollarAmount,
  normalizeCashTag,
  normalizePaymentTag,
  sanitizeText,
  parseEmailDate,
} from "./normalize";

// ---------------------------------------------------------------------------
// Pattern definitions
// Groups are named for clarity; all patterns must match against .trim()ed text.
// ---------------------------------------------------------------------------

// Incoming: "John Doe ($johndoe) sent you $25.00"
// Variations: with/without parens around tag, with/without "for <note>"
const INCOMING_PATTERNS = [
  /(.+?)\s+\((\$[\w.-]+)\)\s+sent\s+you\s+\$?([\d,]+\.?\d*)/i,
  /(.+?)\s+sent\s+you\s+\$?([\d,]+\.?\d*)/i,
  /you\s+received\s+\$?([\d,]+\.?\d*)\s+from\s+(.+?)\s+\((\$[\w.-]+)\)/i,
  /you\s+received\s+\$?([\d,]+\.?\d*)\s+from\s+(.+)/i,
];

// Outgoing: "You sent $25.00 to John Doe ($johndoe)"
const OUTGOING_PATTERNS = [
  /you\s+sent\s+\$?([\d,]+\.?\d*)\s+to\s+(.+?)\s+\((\$[\w.-]+)\)/i,
  /you\s+sent\s+\$?([\d,]+\.?\d*)\s+to\s+(.+)/i,
  /\$?([\d,]+\.?\d*)\s+sent\s+to\s+(.+?)\s+\((\$[\w.-]+)\)/i,
];

// Request sent by us: "You requested $25.00 from John Doe ($johndoe)"
const REQUEST_SENT_PATTERNS = [
  /you\s+requested\s+\$?([\d,]+\.?\d*)\s+from\s+(.+?)\s+\((\$[\w.-]+)\)/i,
  /you\s+requested\s+\$?([\d,]+\.?\d*)\s+from\s+(.+)/i,
  /payment\s+request\s+sent.*?\$?([\d,]+\.?\d*)/i,
];

// Request received: "John Doe ($johndoe) requested $25.00"
const REQUEST_RECEIVED_PATTERNS = [
  /(.+?)\s+\((\$[\w.-]+)\)\s+requested\s+\$?([\d,]+\.?\d*)/i,
  /(.+?)\s+requested\s+\$?([\d,]+\.?\d*)\s+from\s+you/i,
];

// Refunded / reversed
const REFUNDED_PATTERNS = [
  /\$?([\d,]+\.?\d*)\s+(?:has\s+been\s+)?refunded/i,
  /refunded?\s+\$?([\d,]+\.?\d*)/i,
  /payment\s+reversed/i,
  /your\s+payment\s+of\s+\$?([\d,]+\.?\d*)\s+(?:was|has\s+been)\s+reversed/i,
];

// Failed / declined
const FAILED_PATTERNS = [
  /payment\s+(?:failed|declined|unsuccessful)/i,
  /transfer\s+(?:failed|declined)/i,
  /your\s+\$?([\d,]+\.?\d*)\s+payment\s+failed/i,
];

// Note / memo: "for <note>" anywhere in the text
const NOTE_PATTERN = /\bfor\s+"([^"]{1,200})"/i;
const NOTE_PATTERN2 = /\bnote:\s*(.{1,200})/i;

// Transaction ID: looks like "Transaction ID: ABC123XYZ"
const TXN_ID_PATTERN = /transaction\s+(?:id|#)[:\s]+([A-Z0-9]{6,30})/i;

// Date patterns: "on Jun 15, 2025 at 3:42 PM" or "June 15, 2025"
const DATE_PATTERN = /on\s+(\w+ \d{1,2},?\s*\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*[APM]{2})?)/i;

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export interface CashAppParseInput {
  /** Sanitized plain text body of the email */
  textBody: string;
  /** Subject line of the email */
  subject: string;
  /** Email received timestamp (ISO) */
  receivedAt: string | null;
}

export function parseCashAppNotification(input: CashAppParseInput): ParsedPaymentEmail {
  const text = input.textBody.trim();
  const subject = input.subject.trim();
  const combined = `${subject}\n${text}`;

  // --- Extract common fields regardless of activity type ---
  const note = extractNote(combined);
  const txnId = extractTransactionId(combined);
  const dateStr = extractDate(combined) ?? input.receivedAt;

  // --- Attempt to classify ---

  // 1. Incoming
  for (const pattern of INCOMING_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      return buildResult({
        activity_type: "incoming",
        status: "confirmed",
        amount: extractAmountFromMatch(m),
        counterparty_name: extractNameFromMatch(m),
        counterparty_tag: extractTagFromMatch(m),
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Matched incoming pattern: ${pattern.source}`,
      });
    }
  }

  // 2. Outgoing
  for (const pattern of OUTGOING_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      return buildResult({
        activity_type: "outgoing",
        status: "confirmed",
        amount: extractAmountFromMatch(m),
        counterparty_name: extractNameFromMatch(m),
        counterparty_tag: extractTagFromMatch(m),
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Matched outgoing pattern: ${pattern.source}`,
      });
    }
  }

  // 3. Request sent
  for (const pattern of REQUEST_SENT_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      return buildResult({
        activity_type: "request_sent",
        status: "confirmed",
        amount: extractAmountFromMatch(m),
        counterparty_name: extractNameFromMatch(m),
        counterparty_tag: extractTagFromMatch(m),
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Matched request_sent pattern`,
      });
    }
  }

  // 4. Request received
  for (const pattern of REQUEST_RECEIVED_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      return buildResult({
        activity_type: "request_received",
        status: "confirmed",
        amount: extractAmountFromMatch(m),
        counterparty_name: extractNameFromMatch(m),
        counterparty_tag: extractTagFromMatch(m),
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Matched request_received pattern`,
      });
    }
  }

  // 5. Refunded
  for (const pattern of REFUNDED_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      const amount = m[1] ? parseDollarAmount(m[1]) : null;
      return buildResult({
        activity_type: "refunded",
        status: "refunded",
        amount,
        counterparty_name: null,
        counterparty_tag: null,
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Matched refunded pattern`,
      });
    }
  }

  // 6. Failed
  for (const pattern of FAILED_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      const amount = m[1] ? parseDollarAmount(m[1]) : null;
      return buildResult({
        activity_type: "failed",
        status: "failed",
        amount,
        counterparty_name: null,
        counterparty_tag: null,
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "medium",
        parse_notes: `Matched failed pattern`,
      });
    }
  }

  // 7. Unknown format → needs_review
  return buildResult({
    activity_type: "incoming", // placeholder; status overrides to needs_review
    status: "needs_review",
    amount: null,
    counterparty_name: null,
    counterparty_tag: null,
    payment_note: note,
    provider_transaction_id: txnId,
    occurred_at: dateStr,
    parse_confidence: "low",
    parse_notes: `Unknown format. Subject: "${subject.slice(0, 100)}"`,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNote(text: string): string | null {
  const m = text.match(NOTE_PATTERN) ?? text.match(NOTE_PATTERN2);
  return m ? sanitizeText(m[1]) : null;
}

function extractTransactionId(text: string): string | null {
  const m = text.match(TXN_ID_PATTERN);
  return m ? sanitizeText(m[1], 50) : null;
}

function extractDate(text: string): string | null {
  const m = text.match(DATE_PATTERN);
  return m ? parseEmailDate(m[1]) : null;
}

/** Extract dollar amount from the first capture group that looks like a number */
function extractAmountFromMatch(m: RegExpMatchArray): number | null {
  for (const group of m.slice(1)) {
    if (group && /^[\d,]+\.?\d*$/.test(group.trim())) {
      return parseDollarAmount(group);
    }
  }
  return null;
}

/** Extract counterparty name from match groups */
function extractNameFromMatch(m: RegExpMatchArray): string | null {
  for (const group of m.slice(1)) {
    if (group && !/^\$/.test(group) && !/^[\d,]+\.?\d*$/.test(group.trim())) {
      return sanitizeText(group, 200);
    }
  }
  return null;
}

/** Extract cashtag (starts with $) from match groups */
function extractTagFromMatch(m: RegExpMatchArray): string | null {
  for (const group of m.slice(1)) {
    if (group && /^\$[\w.-]+$/.test(group.trim())) {
      return normalizeCashTag(group);
    }
  }
  return null;
}

function buildResult(fields: {
  activity_type: ActivityType;
  status: TransactionStatus;
  amount: number | null;
  counterparty_name: string | null;
  counterparty_tag: string | null;
  payment_note: string | null;
  provider_transaction_id: string | null;
  occurred_at: string | null;
  parse_confidence: "high" | "medium" | "low";
  parse_notes: string | null;
}): ParsedPaymentEmail {
  return {
    provider: "CashApp",
    activity_type: fields.activity_type,
    status: fields.status,
    amount: fields.amount,
    currency: "USD",
    our_account_identifier: null, // set by ingestion layer from gmail_connection mapping
    counterparty_name: fields.counterparty_name,
    counterparty_tag: fields.counterparty_tag,
    payment_note: fields.payment_note,
    provider_transaction_id: fields.provider_transaction_id,
    occurred_at: fields.occurred_at,
    parse_confidence: fields.parse_confidence,
    parse_notes: fields.parse_notes,
  };
}
