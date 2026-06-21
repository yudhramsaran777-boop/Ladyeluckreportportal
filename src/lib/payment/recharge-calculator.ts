// ============================================================================
// Lady E Luck Portal — Recharge Calculator
// Phase 5: Pure, deterministic recharge math.
//
// This module has NO database access and NO side effects.
// It is imported by both the client (live preview) and the server action
// (authoritative calculation). The server action recalculates independently
// and never trusts the client-supplied result.
//
// DB recharge_status values (what gets stored in payment_recharges):
//   'exact'            — coins === cash
//   'bonus_given'      — coins > cash
//   'missing_recharge' — coins < cash
//   'voided'           — set by manager void action
//
// TypeScript RechargeStatus values (what the UI shows):
//   'completed_no_bonus'   maps to 'exact'
//   'completed_with_bonus' maps to 'bonus_given'
//   'under_recharged'      maps to 'missing_recharge'
//   'voided'               maps to 'voided'
// ============================================================================

export type DbRechargeStatus =
  | "exact"
  | "bonus_given"
  | "missing_recharge"
  | "voided";

export interface RechargeCalculation {
  bonus_given: number;
  missing_recharge: number;
  /** Database-safe status value for insertion into payment_recharges. */
  db_recharge_status: DbRechargeStatus;
}

export class RechargeCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RechargeCalculationError";
  }
}

/**
 * Calculate recharge outcome from cash and coins values.
 *
 * Rules (all enforced with safe decimal math):
 *   coins > cash  → bonus_given = coins - cash, missing = 0, status = 'bonus_given'
 *   coins === cash → bonus = 0, missing = 0, status = 'exact'
 *   coins < cash  → bonus = 0, missing = cash - coins, status = 'missing_recharge'
 *
 * Throws RechargeCalculationError for invalid input so callers can surface
 * a safe user-facing message without leaking internals.
 *
 * @param cashReceived  Authoritative cash amount (from transaction.amount on server)
 * @param coinsRecharged Amount of game coins the employee added to the player's account
 */
export function calculateRecharge(
  cashReceived: number,
  coinsRecharged: number
): RechargeCalculation {
  // ---- Guard: reject non-finite values ------------------------------------
  if (typeof cashReceived !== "number" || !isFinite(cashReceived) || isNaN(cashReceived)) {
    throw new RechargeCalculationError("Cash received must be a finite number.");
  }
  if (typeof coinsRecharged !== "number" || !isFinite(coinsRecharged) || isNaN(coinsRecharged)) {
    throw new RechargeCalculationError("Coins recharged must be a finite number.");
  }

  // ---- Guard: reject negatives --------------------------------------------
  if (cashReceived < 0) {
    throw new RechargeCalculationError("Cash received cannot be negative.");
  }
  if (coinsRecharged < 0) {
    throw new RechargeCalculationError("Coins recharged cannot be negative.");
  }

  // ---- Round to 2 decimal places to avoid floating-point drift ------------
  const cash  = round2(cashReceived);
  const coins = round2(coinsRecharged);

  // ---- Calculate ----------------------------------------------------------
  let bonus_given       = 0;
  let missing_recharge  = 0;
  let db_recharge_status: DbRechargeStatus;

  if (coins > cash) {
    bonus_given        = round2(coins - cash);
    missing_recharge   = 0;
    db_recharge_status = "bonus_given";
  } else if (coins < cash) {
    bonus_given        = 0;
    missing_recharge   = round2(cash - coins);
    db_recharge_status = "missing_recharge";
  } else {
    // coins === cash (after rounding)
    bonus_given        = 0;
    missing_recharge   = 0;
    db_recharge_status = "exact";
  }

  // ---- Final safety clamp (should never trigger after guard above) --------
  bonus_given      = Math.max(0, bonus_given);
  missing_recharge = Math.max(0, missing_recharge);

  return { bonus_given, missing_recharge, db_recharge_status };
}

// ---------------------------------------------------------------------------
// Internal helper: round to 2 decimal places
// Uses "round half away from zero" via toFixed to avoid banker's rounding.
// ---------------------------------------------------------------------------
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Map DB recharge_status → human-readable label (used in UI)
// ---------------------------------------------------------------------------

export function dbStatusToLabel(status: DbRechargeStatus | "voided"): string {
  switch (status) {
    case "exact":             return "Exact Recharge";
    case "bonus_given":       return "Bonus Given";
    case "missing_recharge":  return "Under-Recharged";
    case "voided":            return "Voided";
    default:                  return "Unknown";
  }
}
