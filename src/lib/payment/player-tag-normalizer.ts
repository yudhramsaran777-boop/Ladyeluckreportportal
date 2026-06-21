// ============================================================================
// Lady E Luck Portal — Player Tag Normalizer
// Phase 4: Single source of truth for payment tag normalization.
//
// Rules per provider:
//   CashApp  — strip leading $, lowercase, remove spaces/underscores/hyphens
//   Chime    — lowercase, trim, normalize spaces/underscores/hyphens,
//              preserve @ and . when the identifier looks like an email
//
// Used everywhere: employee action, manager verification, matching, future
// auto-match. Do NOT duplicate this logic elsewhere.
// ============================================================================

export type NormalizableProvider = "CashApp" | "Chime";

export interface NormalizeResult {
  normalized: string;
  /** True when the result is usable. False when tag normalizes to empty. */
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function isEmailLike(tag: string): boolean {
  // Simple check: contains @ with at least one char on each side and a dot after @
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tag);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a payment tag for a given provider.
 *
 * Examples:
 *   normalizePaymentTag("$AshleyPay",   "CashApp") → { normalized: "ashleypay",    valid: true }
 *   normalizePaymentTag("Ashley-Pay",   "CashApp") → { normalized: "ashleypay",    valid: true }
 *   normalizePaymentTag("ASHLEY_PAY",   "CashApp") → { normalized: "ashleypay",    valid: true }
 *   normalizePaymentTag("$Ashley Pay",  "CashApp") → { normalized: "ashleypay",    valid: true }
 *   normalizePaymentTag("user@chime.com","Chime")  → { normalized: "user@chime.com",valid: true }
 *   normalizePaymentTag("My-Chime Tag", "Chime")   → { normalized: "mychimetag",   valid: true }
 *   normalizePaymentTag("",             "CashApp") → { normalized: "",             valid: false }
 */
export function normalizePaymentTag(
  raw: string,
  provider: NormalizableProvider
): NormalizeResult {
  if (typeof raw !== "string") {
    return { normalized: "", valid: false, error: "Tag must be a string." };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { normalized: "", valid: false, error: "Payment tag cannot be empty." };
  }

  let normalized: string;

  if (provider === "CashApp") {
    normalized = trimmed
      .replace(/^\$+/, "")   // strip leading $ (one or more)
      .toLowerCase()
      .replace(/[\s_\-]/g, ""); // remove spaces, underscores, hyphens
  } else {
    // Chime
    const lower = trimmed.toLowerCase();
    if (isEmailLike(lower)) {
      // Preserve email structure — only trim and lowercase
      normalized = lower;
    } else {
      // Non-email Chime tag: remove spaces, underscores, hyphens
      normalized = lower.replace(/[\s_\-]/g, "");
    }
  }

  if (normalized.length === 0) {
    return {
      normalized: "",
      valid: false,
      error: "Payment tag is empty after normalization.",
    };
  }

  return { normalized, valid: true };
}

/**
 * Normalize a tag and throw a descriptive error if the result is invalid.
 * Use this inside server actions when you want to short-circuit on bad input.
 */
export function normalizePaymentTagOrThrow(
  raw: string,
  provider: NormalizableProvider
): string {
  const result = normalizePaymentTag(raw, provider);
  if (!result.valid) {
    throw new Error(result.error ?? "Invalid payment tag.");
  }
  return result.normalized;
}
