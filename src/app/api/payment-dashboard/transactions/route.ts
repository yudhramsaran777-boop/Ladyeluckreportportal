/**
 * GET /api/payment-dashboard/transactions
 *
 * Returns payment transactions for the authorized shop.
 *
 * Authentication: Bearer token (from /api/payment-dashboard/token)
 * CORS: validated against DASHBOARD_ALLOWED_ORIGINS
 *
 * Query parameters:
 *   shopId        — required for owner "all" scope tokens; ignored for managers
 *   dateFrom      — ISO date string (optional filter)
 *   dateTo        — ISO date string (optional filter)
 *   status        — comma-separated status filter (optional)
 *   limit         — max rows (default 100, max 500)
 *   offset        — pagination offset (default 0)
 *
 * Response:
 *   { transactions: DashboardTransaction[], total: number }
 *
 * SECURITY:
 *   - shopId is ALWAYS derived from the verified Bearer token.
 *   - shopId query param is only honored for owner tokens with shopId="all".
 *   - Encrypted tokens are NEVER included in any response field.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleCorsOptions, withCors } from "@/lib/payment/cors";
import { extractBearerToken, verifyDashboardToken } from "@/lib/payment/dashboard-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardTransaction } from "@/lib/payment/dashboard-types";

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsOptions(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // --- CORS validation ---
  // (withCors called at the end; validate origin first to fail fast)
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    const res = NextResponse.json({ error: "Bearer token required" }, { status: 401 });
    return withCors(request, res);
  }

  let payload;
  try {
    payload = verifyDashboardToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    const res = NextResponse.json({ error: msg }, { status: 401 });
    return withCors(request, res);
  }

  // --- Determine authorized shop scope ---
  const { searchParams } = request.nextUrl;
  let shopId: string | null = payload.shopId === "all" ? null : payload.shopId;

  // For "all" scope owner tokens, the dashboard can specify a shop
  if (payload.shopId === "all" && payload.role === "owner") {
    const requested = searchParams.get("shopId");
    if (requested?.trim()) {
      shopId = requested.trim();
    }
  }

  // --- Parse query params ---
  const dateFrom = searchParams.get("dateFrom") ?? null;
  const dateTo = searchParams.get("dateTo") ?? null;
  const statusFilter = searchParams.get("status")
    ? searchParams.get("status")!.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const rawLimit = parseInt(searchParams.get("limit") ?? "100", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), 500);
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

  // --- Query ---
  const admin = createAdminClient();

  // Select only safe columns — no token fields exist on payment_transactions,
  // but we are explicit about what we include
  let query = admin
    .from("payment_transactions")
    .select(
      "id, shop_id, payment_account_id, provider, direction, activity_type, " +
      "amount, customer_name, customer_payment_tag, status, is_counted, " +
      "confidence, occurred_at, review_reason, payment_note, created_at",
      { count: "exact" }
    )
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (shopId) {
    query = query.eq("shop_id", shopId);
  }
  if (dateFrom) {
    query = query.gte("occurred_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("occurred_at", dateTo);
  }
  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[payment-dashboard/transactions] Query failed:", error.message);
    const res = NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
    return withCors(request, res);
  }

  interface TxRow {
    id: string;
    shop_id: string;
    payment_account_id: string;
    provider: string;
    direction: "received" | "sent";
    activity_type: string | null;
    amount: number;
    customer_name: string | null;
    customer_payment_tag: string | null;
    status: string;
    is_counted: boolean;
    confidence: number | null;
    occurred_at: string;
    review_reason: string | null;
    payment_note: string | null;
    created_at: string;
  }

  const rows = (data ?? []) as unknown as TxRow[];
  const transactions: DashboardTransaction[] = rows.map((row) => ({
    id: row.id,
    shopId: row.shop_id,
    paymentAccountId: row.payment_account_id,
    provider: row.provider,
    direction: row.direction,
    activityType: row.activity_type,
    amount: row.amount,
    customerName: row.customer_name,
    customerTag: row.customer_payment_tag,
    status: row.status,
    isCounted: row.is_counted,
    confidence: row.confidence,
    occurredAt: row.occurred_at,
    reviewReason: row.review_reason,
    paymentNote: row.payment_note,
    createdAt: row.created_at,
  }));

  const res = NextResponse.json(
    { transactions, total: count ?? 0 },
    { status: 200 }
  );
  return withCors(request, res);
}