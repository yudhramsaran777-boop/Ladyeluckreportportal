// ============================================================================
// Lady E Luck Portal — Chime Email Parser
//
// Parses sanitized text/plain or HTML-derived text from Chime notification
// emails sent by alerts@account.chime.com.
//
// IMPORTANT: Regex patterns here are best-effort stubs based on typical
// Chime notification formats. They MUST be reviewed against real sanitized
// email samples before going live. Unknown formats are routed to needs_review.
// Never silently classify an unknown format as confirmed.
// ============================================================================

import type { ParsedPaymentEmail, ActivityType, TransactionStatus } from "../payment-types";
import {
  parseDollarAmount,
  normalizeChimeTag,
  sanitizeText,
  parseEmailDate,
} from "./normalize";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

// Incoming: "You received $25.00 from Jane Smith"
// Chime also sends: "Jane Smith paid you $25.00"
const INCOMING_PATTERNS = [
  /you\s+received\s+\$?([\d,]+\.?\d*)\s+from\s+(.+)/i,
  /(.+?)\s+paid\s+you\s+\$?([\d,]+\.?\d*)/i,
  /deposit\s+of\s+\$?([\d,]+\.?\d*)\s+from\s+(.+)/i,
  /\$?([\d,]+\.?\d*)\s+was\s+deposited\s+(?:into\s+your\s+account\s+)?from\s+(.+)/i,
];

// Outgoing: "You sent $25.00 to Jane Smith"
const OUTGOING_PATTERNS = [
  /you\s+sent\s+\$?([\d,]+\.?\d*)\s+to\s+(.+)/i,
  /\$?([\d,]+\.?\d*)\s+sent\s+to\s+(.+)/i,
  /you\s+transferred\s+\$?([\d,]+\.?\d*)\s+to\s+(.+)/i,
];

// Request sent: "You requested $25.00 from Jane Smith" (if supported by Chime)
const REQUEST_SENT_PATTERNS = [
  /you\s+requested\s+\$?([\d,]+\.?\d*)\s+from\s+(.+)/i,
  /payment\s+request\s+sent.*?\$?([\d,]+\.?\d*)/i,
];

// Request received: "Jane Smith requested $25.00" (if supported by Chime)
const REQUEST_RECEIVED_PATTERNS = [
  /(.+?)\s+requested\s+\$?([\d,]+\.?\d*)\s+from\s+you/i,
  /(.+?)\s+sent\s+you\s+a\s+payment\s+request\s+for\s+\$?([\d,]+\.?\d*)/i,
];

// Refunded / reversed
const REFUNDED_PATTERNS = [
  /\$?([\d,]+\.?\d*)\s+(?:has\s+been\s+)?refunded/i,
  /refund(?:ed)?\s+of\s+\$?([\d,]+\.?\d*)/i,
  /transaction\s+reversed/i,
  /your\s+transfer\s+(?:was|has\s+been)\s+reversed/i,
];

// Failed / declined
const FAILED_PATTERNS = [
  /payment\s+(?:failed|declined|unsuccessful)/i,
  /transfer\s+(?:failed|declined)/i,
  /your\s+payment\s+of\s+\$?([\d,]+\.?\d*)\s+(?:was\s+)?(?:unable|failed)/i,
  /unable\s+to\s+process\s+your\s+payment/i,
];

const NOTE_PATTERN = /\bfor\s+"([^"]{1,200})"/i;
const NOTE_PATTERN2 = /\bmemo:\s*(.{1,200})/i;
const NOTE_PATTERN3 = /\bnote:\s*(.{1,200})/i;
const TXN_ID_PATTERN = /transaction\s+(?:id|#)[:\s]+([A-Z0-9]{6,30})/i;
const DATE_PATTERN = /on\s+(\w+ \d{1,2},?\s*\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*[APM]{2})?)/i;

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export interface ChimeParseInput {
  textBody: string;
  subject: string;
  receivedAt: string | null;
}

export function parseChimeNotification(input: ChimeParseInput): ParsedPaymentEmail {
  const text = input.textBody.trim();
  const subject = input.subject.trim();
  const combined = `${subject}\n${text}`;

  const note = extractNote(combined);
  const txnId = extractTransactionId(combined);
  const dateStr = extractDate(combined) ?? input.receivedAt;

  // 1. Incoming
  for (const pattern of INCOMING_PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      return buildResult({
        activity_type: "incoming",
        status: "confirmed",
        amount: extractAmountFromMatch(m),
        counterparty_name: extractNameFromMatch(m),
        counterparty_tag: null, // Chime doesn't always expose the tag in emails
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Chime: matched incoming pattern`,
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
        counterparty_tag: null,
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Chime: matched outgoing pattern`,
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
        counterparty_tag: null,
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Chime: matched request_sent pattern`,
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
        counterparty_tag: null,
        payment_note: note,
        provider_transaction_id: txnId,
        occurred_at: dateStr,
        parse_confidence: "high",
        parse_notes: `Chime: matched request_received pattern`,
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
        parse_notes: `Chime: matched refunded pattern`,
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
        parse_notes: `Chime: matched failed pattern`,
      });
    }
  }

  // 7. Unknown → needs_review
  return buildResult({
    activity_type: "incoming",
    status: "needs_review",
    amount: null,
    counterparty_name: null,
    counterparty_tag: null,
    payment_note: note,
    provider_transaction_id: txnId,
    occurred_at: dateStr,
    parse_confidence: "low",
    parse_notes: `Chime: unknown format. Subject: "${subject.slice(0, 100)}"`,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNote(text: string): string | null {
  const m =
    text.match(NOTE_PATTERN) ??
    text.match(NOTE_PATTERN2) ??
    text.match(NOTE_PATTERN3);
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

function extractAmountFromMatch(m: RegExpMatchArray): number | null {
  for (const group of m.slice(1)) {
    if (group && /^[\d,]+\.?\d*$/.test(group.trim())) {
      return parseDollarAmount(group);
    }
  }
  return null;
}

function extractNameFromMatch(m: RegExpMatchArray): string | null {
  for (const group of m.slice(1)) {
    if (group && !/^[\d,]+\.?\d*$/.test(group.trim())) {
      return sanitizeText(group, 200);
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
    provider: "Chime",
    activity_type: fields.activity_type,
    status: fields.status,
    amount: fields.amount,
    currency: "USD",
    our_account_identifier: null,
    counterparty_name: fields.counterparty_name,
    counterparty_tag: fields.counterparty_tag,
    payment_note: fields.payment_note,
    provider_transaction_id: fields.provider_transaction_id,
    occurred_at: fields.occurred_at,
    parse_confidence: fields.parse_confidence,
    parse_notes: fields.parse_notes,
  };
}
