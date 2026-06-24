/**
 * Shared TypeScript types for the payment dashboard API.
 *
 * These types define the shapes returned by /api/payment-dashboard/* endpoints.
 * They are intentionally separate from the internal DB schema types to ensure
 * that sensitive fields (tokens, credentials, raw email bodies) can NEVER
 * accidentally appear in API responses.
 */

// ---------------------------------------------------------------------------
// Dashboard Bearer Token
// ---------------------------------------------------------------------------

export interface DashboardTokenPayload {
  sub: string;      // user ID (UUID)
  role: string;     // 'owner' | 'manager'
  shopId: string;   // authorized shop UUID
  iat: number;      // issued-at (unix seconds)
  exp: number;      // expiry (unix seconds) — 15 minutes from iat
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export interface DashboardConnection {
  id: string;
  shopId: string;
  paymentAccountId: string;
  emailAddress: string;
  connectionStatus: string;
  lastSyncedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  connectedAt: string | null;
  // Tokens are NEVER included — encrypted_access_token / encrypted_refresh_token
  // are excluded at the query level
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface DashboardTransaction {
  id: string;
  shopId: string;
  paymentAccountId: string;
  provider: string;
  direction: "received" | "sent";
  activityType: string | null;
  amount: number;
  customerName: string | null;
  customerTag: string | null;
  status: string;
  isCounted: boolean;
  confidence: number | null;
  occurredAt: string;
  reviewReason: string | null;
  paymentNote: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  shopId: string;
  dateFrom: string | null;
  dateTo: string | null;
  totalReceived: number;
  totalSent: number;
  countedReceived: number;
  transactionCount: number;
  countedCount: number;
  needsReviewCount: number;
}

// ---------------------------------------------------------------------------
// Review action
// ---------------------------------------------------------------------------

export type ReviewActionType = "approve" | "reject" | "void";

export interface ReviewAction {
  transactionId: string;
  action: ReviewActionType;
  reviewNote?: string;
}
