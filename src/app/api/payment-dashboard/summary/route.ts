/**
 * GET /api/payment-dashboard/summary
 *
 * Returns aggregated payment summary statistics for the authorized shop.
 *
 * Authentication: Bearer token (from /api/payment-dashboard/token)
 * CORS: validated against DASHBOARD_ALLOWED_ORIGINS
 *
 * Query parameters:
 *   shopId   — required for owner "all" scope tokens
 *   dateFrom — ISO date string (optional)
 *   dateTo   — ISO date string (optional)
 *
 * Response:
 *   { summary: DashboardSummary }
 *
 * Aggregates are computed server-side using the admin client — no raw data
 * is returned that could expose individual transactions beyond the totals.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleCorsOptions, withCors } from "@/lib/payment/cors";
import { extractBearerToken, verifyDashboardToken } from "@/lib/payment/dashboard-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardSummary } from "@/lib/payment/dashboard-types";

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsOptions(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = request.nextUrl;
  let shopId: string | null = payload.shopId === "all" ? null : payload.shopId;

  if (payload.shopId === "all" && payload.role === "owner") {
    const requested = searchParams.get("shopId");
    if (requested?.trim()) shopId = requested.trim();
  }

  const dateFrom = searchParams.get("dateFrom") ?? null;
  const dateTo = searchParams.get("dateTo") ?? null;

  const admin = createAdminClient();

  // Build base filters for the aggregate query
  let query = admin
    .from("payment_transactions")
    .select("direction, amount, status, is_counted");

  if (shopId) query = query.eq("shop_id", shopId);
  if (dateFrom) query = query.gte("occurred_at", dateFrom);
  if (dateTo) query = query.lte("occurred_at", dateTo);

  // Exclude voided transactions from all aggregates
  query = query.not("status", "eq", "voided");

  const { data, error } = await query;

  if (error) {
    console.error("[payment-dashboard/summary] Query failed:", error.message);
    const res = NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
    return withCors(request, res);
  }

  const rows = (data ?? []) as Array<{
    direction: string;
    amount: number;
    status: string;
    is_counted: boolean;
  }>;

  // Compute aggregates server-side
  let totalReceived = 0;
  let totalSent = 0;
  let countedReceived = 0;
  let countedCount = 0;
  let needsReviewCount = 0;

  for (const row of rows) {
    const amt = Number(row.amount) || 0;
    if (row.direction === "received") totalReceived += amt;
    if (row.direction === "sent") totalSent += amt;
    if (row.is_counted && row.direction === "received") countedReceived += amt;
    if (row.is_counted) countedCount++;
    if (row.status === "needs_review") needsReviewCount++;
  }

  const summary: DashboardSummary = {
    shopId: shopId ?? "all",
    dateFrom,
    dateTo,
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalSent: Math.round(totalSent * 100) / 100,
    countedReceived: Math.round(countedReceived * 100) / 100,
    transactionCount: rows.length,
    countedCount,
    needsReviewCount,
  };

  const res = NextResponse.json({ summary }, { status: 200 });
  return withCors(request, res);
}
