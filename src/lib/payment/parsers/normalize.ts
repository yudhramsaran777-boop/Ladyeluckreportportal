// ============================================================================
// Lady E Luck Portal — Parser Utilities
// Shared normalization helpers used by both Cash App and Chime parsers.
// ============================================================================

/**
 * Parse a currency string like "$25.00", "25", "1,200.50" into a number.
 * Returns null if parsing fails.
 */
export function parseDollarAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  // Remove $, commas, whitespace then parse
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  if (!isFinite(n) || n < 0) return null;
  // Round to 2 decimal places to avoid floating-point drift
  return Math.round(n * 100) / 100;
}

/**
 * Normalize a Cash App cashtag: lowercase, ensure leading $, strip whitespace.
 * Returns null if input is empty or clearly not a cashtag.
 */
export function normalizeCashTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  // Must contain at least one alphanumeric after the optional $
  const withoutDollar = trimmed.startsWith("$") ? trimmed.slice(1) : trimmed;
  if (!/^[a-z0-9_.-]{1,20}$/i.test(withoutDollar)) return null;
  return `$${withoutDollar}`;
}

/**
 * Normalize a Chime tag similarly (no leading $ requirement for Chime).
 */
export function normalizeChimeTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Normalize any payment tag for DB storage: lowercase, strip $, trim.
 * Used for the normalized_customer_payment_tag column.
 */
export function normalizePaymentTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/[$\s]/g, "").toLowerCase() || null;
}

/**
 * Sanitize a string extracted from email HTML/text before storing.
 * Trims whitespace, collapses internal whitespace, caps length.
 */
export function sanitizeText(raw: string | null | undefined, maxLen = 500): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

/**
 * Parse various date/time formats from Cash App and Chime emails into ISO.
 * Returns null if unparseable.
 */
export function parseEmailDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try direct Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

/**
 * Normalize sender email to lowercase for allowlist comparison.
 */
export function normalizeSenderEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Allowed payment notification senders */
export const ALLOWED_SENDERS = {
  CASHAPP: "cash@square.com",
  CHIME: "alerts@account.chime.com",
} as const;
