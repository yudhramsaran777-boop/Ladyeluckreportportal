/**
 * Payment email parsers — Cash App and Chime.
 * SERVER-ONLY. Deterministic parsing only. No AI.
 *
 * A transaction is only counted (is_counted=true, confidence=1.0) when ALL
 * of the following are identified from the email:
 *   - Sender validated (handled upstream in ingestion)
 *   - Direction (received / sent)
 *   - Amount > 0
 *   - Occurred timestamp
 *
 * If any required field is missing, the result has confidence < 1.0 and the
 * transaction goes to status='needs_review', is_counted=false.
 *
 * CHIME PARSING IS REVIEW-ONLY: All Chime parse results have confidence=0.5
 * and will never be counted until tested against real anonymized Chime emails
 * and this restriction is explicitly lifted by the owner.
 */

export type PaymentProvider = "CashApp" | "Chime";
export type PaymentDirection = "received" | "sent";
export type ActivityType =
  | "incoming"
  | "outgoing"
  | "request_sent"
  | "request_received"
  | "refunded"
  | "failed";

export interface ParsedPayment {
  provider: PaymentProvider;
  direction: PaymentDirection;
  activityType: ActivityType;
  amount: number;
  customerName: string | null;
  customerTag: string | null;
  normalizedCustomerTag: string | null;
  providerTransactionId: string | null;
  occurredAt: Date;
  paymentNote: string | null;
  /**
   * confidence = 1.0 → all required fields found; eligible to be counted
   * confidence = 0.5 → partial parse or review-only provider
   * confidence = 0.0 → could not parse (should not be stored as a transaction)
   */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Cash App Parser
// ---------------------------------------------------------------------------

/**
 * Normalize a Cash App $cashtag.
 * "$SomeTag" → "sometag"  (leading $ stripped, lowercased, trimmed)
 */
function normalizeCashTag(raw: string): string {
  return raw.replace(/^\$/, "").toLowerCase().trim();
}

/**
 * Parse a Cash App payment notification email.
 *
 * Returns null if the subject/body does not appear to be a Cash App notification.
 * Returns a ParsedPayment with confidence < 1.0 for partial parses.
 */
export function parseCashAppEmail(
  subject: string,
  body: string,
  receivedAt: Date
): ParsedPayment | null {
  const subj = subject.trim();

  // --- Classify email type from subject ---
  let direction: PaymentDirection = "received";
  let activityType: ActivityType = "incoming";

  if (/you received/i.test(subj)) {
    direction = "received";
    activityType = "incoming";
  } else if (/you sent/i.test(subj)) {
    direction = "sent";
    activityType = "outgoing";
  } else if (/payment request/i.test(subj) || /requesting/i.test(subj)) {
    direction = "sent";
    activityType = /from/i.test(subj) ? "request_received" : "request_sent";
    // Requests are not completed payments — always needs_review
    return {
      provider: "CashApp",
      direction,
      activityType,
      amount: 0,
      customerName: null,
      customerTag: null,
      normalizedCustomerTag: null,
      providerTransactionId: null,
      occurredAt: receivedAt,
      paymentNote: null,
      confidence: 0.5,
    };
  } else if (/refund/i.test(subj)) {
    direction = "received";
    activityType = "refunded";
    return {
      provider: "CashApp",
      direction,
      activityType,
      amount: 0,
      customerName: null,
      customerTag: null,
      normalizedCustomerTag: null,
      providerTransactionId: null,
      occurredAt: receivedAt,
      paymentNote: null,
      confidence: 0.5,
    };
  } else if (/failed|declined/i.test(subj)) {
    return {
      provider: "CashApp",
      direction: "sent",
      activityType: "failed",
      amount: 0,
      customerName: null,
      customerTag: null,
      normalizedCustomerTag: null,
      providerTransactionId: null,
      occurredAt: receivedAt,
      paymentNote: null,
      confidence: 0.5,
    };
  } else {
    // Not a recognizable Cash App payment notification
    return null;
  }

  // --- Amount extraction ---
  // Match "$50", "$50.00", "$1,250.00" — first match in body
  const amountMatch = body.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(/,/g, ""))
    : null;

  // --- Customer $cashtag extraction ---
  // Cash App tags are $word where word starts with a letter and is 1-20 chars
  // We skip pure-digit sequences (those are amounts)
  const tagPattern = /\$([A-Za-z][A-Za-z0-9_-]{0,19})/g;
  const tagMatches = [...body.matchAll(tagPattern)];
  const rawTag = tagMatches.length > 0 ? `$${tagMatches[0][1]}` : null;
  const normalizedCustomerTag = rawTag ? normalizeCashTag(rawTag) : null;

  // --- Customer display name from subject ---
  // "You received $50 from John Doe" or "You sent $50 to Jane Smith"
  let customerName: string | null = null;
  const nameMatchFrom = subj.match(/(?:from|to)\s+([^$\n]+?)(?:\s+on Cash App|$)/i);
  if (nameMatchFrom?.[1]) {
    const candidate = nameMatchFrom[1].trim();
    if (candidate.length > 0 && candidate.length < 100) {
      customerName = candidate;
    }
  }

  // --- Provider transaction ID ---
  // Cash App transaction IDs are typically uppercase alphanumeric, 20+ chars
  // They appear in the email body (not subject)
  const txIdMatch = body.match(/\b([A-Z0-9]{20,})\b/);
  const providerTransactionId = txIdMatch ? txIdMatch[1] : null;

  // --- Payment note/memo ---
  const noteMatch = body.match(/(?:Note|For|Memo):\s*(.+?)(?:\n|$)/i);
  const paymentNote = noteMatch?.[1]?.trim() ?? null;

  // --- Confidence ---
  // High confidence (1.0) requires: direction + positive amount + timestamp
  // Timestamp is always receivedAt, so we only need direction + amount
  const confidence =
    direction !== null && amount !== null && amount > 0 ? 1.0 : 0.5;

  return {
    provider: "CashApp",
    direction,
    activityType,
    amount: amount ?? 0,
    customerName,
    customerTag: rawTag,
    normalizedCustomerTag,
    providerTransactionId,
    occurredAt: receivedAt,
    paymentNote,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Chime Parser — REVIEW-ONLY
// ---------------------------------------------------------------------------

/**
 * Parse a Chime payment notification email.
 *
 * REVIEW-ONLY: All results have confidence=0.5 and will never be auto-counted.
 * Chime parsing must remain disabled for counting until tested against real
 * anonymized Chime emails and explicitly enabled by the owner.
 *
 * Returns null if the email does not appear to be a Chime payment notification.
 */
export function parseChimeEmail(
  subject: string,
  body: string,
  receivedAt: Date
): ParsedPayment | null {
  const subj = subject.trim();
  const bodyPreview = body.slice(0, 1000);

  // Basic Chime signal — must pass this gate before extracting anything
  const isChimeSignal =
    /pay|transfer|deposit|withdraw|sent|received|move/i.test(subj) ||
    /chime|pay anyone/i.test(bodyPreview);

  if (!isChimeSignal) return null;

  // Direction heuristic
  let direction: PaymentDirection = "received";
  let activityType: ActivityType = "incoming";
  if (/you sent|pay anyone|transfer to|moved to/i.test(subj)) {
    direction = "sent";
    activityType = "outgoing";
  }

  // Amount — for reference only (never counted automatically)
  const amountMatch = body.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  // All Chime results go to needs_review with confidence=0.5
  return {
    provider: "Chime",
    direction,
    activityType,
    amount,
    customerName: null,
    customerTag: null,
    normalizedCustomerTag: null,
    providerTransactionId: null,
    occurredAt: receivedAt,
    paymentNote: null,
    confidence: 0.5, // ALWAYS 0.5 — never auto-counted
  };
}

// ---------------------------------------------------------------------------
// Parser router
// ---------------------------------------------------------------------------

/**
 * Route an email to the appropriate parser based on the validated provider.
 */
export function parsePaymentEmail(
  provider: string,
  subject: string,
  body: string,
  receivedAt: Date
): ParsedPayment | null {
  if (provider === "CashApp") {
    return parseCashAppEmail(subject, body, receivedAt);
  }
  if (provider === "Chime") {
    return parseChimeEmail(subject, body, receivedAt);
  }
  return null;
}
