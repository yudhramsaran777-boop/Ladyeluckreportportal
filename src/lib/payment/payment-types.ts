// ============================================================================
// Lady E Luck Portal -- Payment System TypeScript Types
// Phase 1-7: Definitions only. No runtime logic here.
// ============================================================================

export type PaymentProvider = "CashApp" | "Chime";
export type TransactionDirection = "received" | "sent";

// Six canonical activity types (migration 0020+)
export type ActivityType =
  | "incoming"
  | "outgoing"
  | "request_sent"
  | "request_received"
  | "refunded"
  | "failed";

// Human-readable labels for activity types
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  incoming: "Received",
  outgoing: "Sent",
  request_sent: "Request Sent",
  request_received: "Request Received",
  refunded: "Refunded",
  failed: "Failed",
};

// Activity types that count toward confirmed financial totals
export const COUNTABLE_ACTIVITY_TYPES: ActivityType[] = ["incoming", "outgoing"];

export type TransactionStatus =
  | "confirmed"
  | "pending"
  | "failed"
  | "cancelled"
  | "canceled"
  | "refunded"
  | "reversed"
  | "duplicate"
  | "rejected_sender"
  | "unknown_format"
  | "needs_review"
  | "rejected"
  | "voided";

export type PlayerMatchStatus =
  | "unmatched"
  | "matched"
  | "conflicting"
  | "blocked"
  | "needs_review"
  | "multiple_matches";

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
  coins_recharged: number | null;
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
  cash_received: number;
  coins_recharged: number;
  bonus_given: number;
  missing_recharge: number;
  recharge_status: RechargeStatus;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Gmail connection metadata (no token fields -- those never leave the server)
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

// ---------------------------------------------------------------------------
// Phase 4: Player mapping action types
// ---------------------------------------------------------------------------

export interface PlayerMappingInput {
  transactionId: string;
  playerName: string;
  facebookName?: string;
  gameUsername?: string;
  primaryGame?: string;
  internalNote?: string;
}

export interface EditPlayerMappingInput {
  mappingId: string;
  playerName: string;
  facebookName?: string;
  gameUsername?: string;
  primaryGame?: string;
  internalNote?: string;
}

export interface PlayerMappingResult {
  success: boolean;
  mappingId?: string;
  transactionId?: string;
  playerName?: string;
  playerMatchStatus?: PlayerMatchStatus;
  error?: string;
}

export interface AddPlayerPanelTransaction {
  id: string;
  provider: PaymentProvider;
  payment_account_name: string;
  business_payment_tag: string | null;
  customer_payment_tag: string | null;
  customer_name: string | null;
  individual_amount: number;
  occurred_at: string;
  direction: TransactionDirection;
  transaction_status: TransactionStatus;
  player_mapping_id: string | null;
  player_name: string | null;
  game_username: string | null;
}

export interface PlayerSearchResult {
  id: string;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  provider: PaymentProvider;
  payment_tag: string;
  verification_status: MappingVerificationStatus;
}

// ---------------------------------------------------------------------------
// Phase 5: Recharge types
// ---------------------------------------------------------------------------

export interface RechargeInput {
  transactionId: string;
  gameId: string;
  gameUsername: string;
  coinsRecharged: number;
  notes?: string;
}

export interface RechargeResult {
  success: boolean;
  rechargeId?: string;
  transactionId?: string;
  rechargeStatus?: RechargeStatus;
  bonusGiven?: number;
  missingRecharge?: number;
  coinsRecharged?: number;
  error?: string;
}

export interface RechargeCalculation {
  bonus_given: number;
  missing_recharge: number;
  recharge_status: RechargeStatus;
}

export interface RechargeDialogTransaction {
  id: string;
  provider: PaymentProvider;
  payment_account_name: string;
  business_payment_tag: string | null;
  customer_payment_tag: string | null;
  customer_name: string | null;
  player_name: string | null;
  game_username: string | null;
  individual_amount: number;
  occurred_at: string;
  direction: TransactionDirection;
  transaction_status: TransactionStatus;
  player_mapping_id: string | null;
}

export interface ActiveGame {
  id: string;
  game_code: string;
  game_name: string;
}

export interface ManagerRechargeRow {
  id: string;
  shop_id: string;
  payment_transaction_id: string;
  employee_id: string | null;
  employee_name: string | null;
  player_name: string | null;
  game_name: string | null;
  game_username: string | null;
  cash_received: number;
  coins_recharged: number;
  bonus_given: number;
  missing_recharge: number;
  recharge_status: RechargeStatus;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  voided_by_name: string | null;
  created_at: string;
  transaction_occurred_at: string | null;
}

export interface VoidRechargeInput {
  rechargeId: string;
  reason: string;
}

export interface VoidRechargeResult {
  success: boolean;
  rechargeId?: string;
  error?: string;
}
export interface ManagerPlayerMappingRow {
  id: string;
  shop_id: string;
  provider: PaymentProvider;
  payment_tag: string;
  normalized_payment_tag: string;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  internal_note: string | null;
  manager_review_reason: string | null;
  verification_status: MappingVerificationStatus;
  status: "active" | "inactive";
  added_by: string | null;
  added_by_name: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 7: Manager Payments Dashboard types (NEVER sent to employees)
// ---------------------------------------------------------------------------

/** Daily / period financial totals -- manager/owner only */
export interface ManagerPaymentTotals {
  shop_id: string;
  period_start: string;
  period_end: string;
  // Confirmed incoming totals
  incoming_total: number;
  incoming_cashapp: number;
  incoming_chime: number;
  // Confirmed outgoing totals
  outgoing_total: number;
  outgoing_cashapp: number;
  outgoing_chime: number;
  // Net
  net_activity: number;
  // Non-financial counts (never affect totals)
  request_sent_count: number;
  request_sent_total: number;
  request_received_count: number;
  request_received_total: number;
  refunded_count: number;
  refunded_total: number;
  failed_count: number;
  needs_review_count: number;
  duplicate_count: number;
}

/** Manager-visible full transaction row (superset of employee row) */
export interface ManagerPaymentTransaction {
  id: string;
  occurred_at: string;
  email_received_at: string | null;
  provider: PaymentProvider;
  activity_type: ActivityType;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount: number;
  payment_account_id: string | null;
  payment_account_name: string | null;
  our_account_identifier: string | null;
  counterparty_name: string | null;
  counterparty_tag: string | null;
  normalized_counterparty_tag: string | null;
  payment_note: string | null;
  provider_transaction_id: string | null;
  player_name: string | null;
  player_match_status: PlayerMatchStatus;
  is_counted: boolean;
  review_reason: string | null;
  // Manager-only fields (always null on API responses for security)
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  email_subject: string | null;
  gmail_connection_id: string | null;
}

/** Tag history entry for manager Customers & Tags view */
export interface TagHistoryEntry {
  id: string;
  shop_id: string;
  provider: PaymentProvider;
  payment_tag: string;
  normalized_payment_tag: string;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  verification_status: MappingVerificationStatus;
  status: "active" | "inactive";
  // Aggregate stats (manager only)
  transaction_count: number;
  confirmed_incoming_total: number;
  confirmed_outgoing_total: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  added_by_name: string | null;
  verified_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Sync log row for manager Sync Status view */
export interface SyncLogRow {
  id: string;
  shop_id: string;
  gmail_connection_id: string | null;
  gmail_address: string | null;
  sync_type: "push_notification" | "reconciliation" | "manual" | "watch_renewal";
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  emails_found: number;
  emails_processed: number;
  records_created: number;
  records_skipped: number;
  errors_found: number;
  error_summary: string | null;
  history_id_start: string | null;
  history_id_end: string | null;
}

/** Gmail connection display row for manager UI */
export interface GmailConnectionRow {
  id: string;
  shop_id: string;
  payment_account_id: string;
  payment_account_label: string | null;
  email_address: string;
  connection_status: string;
  watch_expires_at: string | null;
  last_synced_at: string | null;
  last_sync_attempt_at: string | null;
  last_error_message: string | null;
  connected_at: string | null;
}

/** Needs-review transaction row for manager review queue */
export interface NeedsReviewRow {
  id: string;
  shop_id: string;
  occurred_at: string;
  provider: PaymentProvider;
  activity_type: ActivityType | null;
  status: TransactionStatus;
  amount: number;
  counterparty_name: string | null;
  counterparty_tag: string | null;
  payment_note: string | null;
  review_reason: string | null;
  email_subject: string | null;
  created_at: string;
}

/** Manager filter params for payment activity */
export interface ManagerTransactionFilters {
  dateStart?: string | null;
  dateEnd?: string | null;
  provider?: PaymentProvider | null;
  activityType?: ActivityType | null;
  status?: TransactionStatus | null;
  accountId?: string | null;
  searchTag?: string | null;
  searchPlayer?: string | null;
  searchNote?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  limit?: number;
  cursor?: string | null;
}

/** Parsed email result from Cash App / Chime parser */
export interface ParsedPaymentEmail {
  provider: PaymentProvider;
  activity_type: ActivityType;
  status: TransactionStatus;
  amount: number | null;
  currency: string;
  our_account_identifier: string | null;
  counterparty_name: string | null;
  counterparty_tag: string | null;
  payment_note: string | null;
  provider_transaction_id: string | null;
  occurred_at: string | null;
  parse_confidence: "high" | "medium" | "low";
  parse_notes: string | null;
}

/** Result of processing a single Gmail message through the ingestion pipeline */
export interface IngestionResult {
  gmail_message_id: string;
  outcome: "created" | "duplicate" | "rejected" | "needs_review" | "error";
  transaction_id?: string;
  reason?: string;
}
