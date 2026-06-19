// ============================================================================
// Lady E Luck Portal — Payment System TypeScript Types
// Phase 1: Definitions only. No runtime logic here.
// ============================================================================

export type PaymentProvider = "CashApp" | "Chime";
export type TransactionDirection = "received" | "sent";

export type TransactionStatus =
  | "confirmed"
  | "pending"
  | "failed"
  | "cancelled"
  | "refunded"
  | "reversed"
  | "duplicate"
  | "rejected_sender"
  | "unknown_format"
  | "needs_review";

export type PlayerMatchStatus =
  | "unmatched"
  | "matched"
  | "conflicting"
  | "blocked";

export type RechargeStatus =
  | "completed_with_bonus"
  | "completed_no_bonus"
  | "under_recharged"
  | "needs_review"
  | "voided";

export type MappingVerificationStatus =
  | "unmatched"
  | "employee_added"
  | "manager_verified"
  | "needs_review"
  | "conflicting_match"
  | "blocked"
  | "inactive";

export type GmailConnectionStatus =
  | "not_connected"
  | "connected"
  | "needs_reconnect"
  | "sync_error"
  | "watch_expired"
  | "disconnected";

export type SenderVerificationStatus =
  | "pending_verification"
  | "verified"
  | "rejected"
  | "inactive";

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export interface PaymentFeatureFlags {
  payment_dashboard_enabled: boolean;
  gmail_sync_enabled: boolean;
  manager_payment_summary_enabled: boolean;
}

export const DEFAULT_PAYMENT_FLAGS: PaymentFeatureFlags = {
  payment_dashboard_enabled: false,
  gmail_sync_enabled: false,
  manager_payment_summary_enabled: false,
};

// ---------------------------------------------------------------------------
// Employee-safe transaction shape
// IMPORTANT: This shape must never include aggregate totals.
// ---------------------------------------------------------------------------

export interface EmployeePaymentTransaction {
  id: string;
  occurred_at: string;
  provider: PaymentProvider;
  payment_account_name: string;
  business_payment_tag: string | null;
  direction: TransactionDirection;
  individual_amount: number;
  customer_payment_tag: string | null;
  customer_name: string | null;
  player_name: string | null;
  game_username: string | null;
  transaction_status: TransactionStatus;
  player_match_status: PlayerMatchStatus;
  recharge_status: RechargeStatus | null;
  specific_recharge_bonus: number | null;
  specific_missing_recharge: number | null;
  can_add_player: boolean;
  can_recharge: boolean;
  player_mapping_id: string | null;
  recharge_id: string | null;
}

// ---------------------------------------------------------------------------
// Manager-only aggregate summary
// NEVER returned to employees.
// ---------------------------------------------------------------------------

export interface ManagerPaymentSummary {
  shop_id: string;
  period_start: string;
  period_end: string;
  total_received: number;
  total_sent: number;
  net_flow: number;
  cashapp_received: number;
  cashapp_sent: number;
  chime_received: number;
  chime_sent: number;
  total_coins_recharged: number;
  total_bonus_given: number;
  total_missing_recharge: number;
  transactions_needing_review: number;
  unmatched_tags: number;
  gmail_sync_errors: number;
}

// ---------------------------------------------------------------------------
// Player payment tag mapping
// ---------------------------------------------------------------------------

export interface PlayerMapping {
  id: string;
  shop_id: string;
  provider: PaymentProvider;
  payment_tag: string;
  normalized_payment_tag: string;
  player_id: string | null;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  internal_note: string | null;
  verification_status: MappingVerificationStatus;
  added_by: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Recharge record
// ---------------------------------------------------------------------------

export interface RechargeRecord {
  id: string;
  shop_id: string;
  payment_transaction_id: string;
  employee_id: string;
  player_id: string | null;
  game_id: string | null;
  game_username: string | null;
  cash_received: number;      // immutable — copied from transaction.amount
  coins_recharged: number;    // entered by employee
  bonus_given: number;        // GREATEST(coins_recharged - cash_received, 0)
  missing_recharge: number;   // GREATEST(cash_received - coins_recharged, 0)
  recharge_status: RechargeStatus;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Gmail connection metadata (no token fields — those never leave the server)
// ---------------------------------------------------------------------------

export interface GmailConnectionDisplay {
  id: string;
  payment_account_id: string;
  email_address: string;
  connection_status: GmailConnectionStatus;
  last_synced_at: string | null;
  last_sync_attempt_at: string | null;
  watch_expires_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string | null;
}

// ---------------------------------------------------------------------------
// Add-player form input
// ---------------------------------------------------------------------------

export interface AddPlayerFormValues {
  player_name: string;
  facebook_name: string;
  game_username: string;
  primary_game: string;
  internal_note: string;
}

// ---------------------------------------------------------------------------
// Recharge form input
// ---------------------------------------------------------------------------

export interface RechargeFormValues {
  game_id: string;
  game_username: string;
  coins_recharged: number;
  notes: string;
}
