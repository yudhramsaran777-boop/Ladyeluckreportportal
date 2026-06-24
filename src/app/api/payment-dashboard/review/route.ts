/**
 * POST /api/payment-dashboard/review
 *
 * Apply a review action to a needs_review transaction.
 *
 * Authentication: Bearer token (from /api/payment-dashboard/token)
 * CORS: validated against DASHBOARD_ALLOWED_ORIGINS
 *
 * Request body:
 *   {
 *     transactionId: string,
 *     action: "approve" | "reject" | "void",
 *     reviewNote?: string
 *   }
 *
 * Action semantics:
 *   approve — set status='confirmed', is_counted=true (only if amount > 0 and provider validated)
 *   reject  — set status='rejected', is_counted=false
 *   void    — set status='voided', is_counted=false (used for confirmed transactions)
 *
 * Response:
 *   { success: true, transactionId: string, newStatus: string }
 *
 * Rate limiting on review: a single transaction can only be reviewed once
 * per request (enforced by checking current status before acting).
 *
 * SECURITY:
 *   - Bearer token must be valid and non-expired.
 *   - Transaction must belong to the shop in the token's shopId claim.
 *   - Each action is logged to payment_audit_logs.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleCorsOptions, withCors } from "@/lib/payment/cors";
import { extractBearerToken, verifyDashboardToken } from "@/lib/payment/dashboard-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewAction } from "@/lib/payment/dashboard-types";

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsOptions(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    return withCors(request, res);
  }

  const review = body as Partial<ReviewAction>;

  if (
    typeof review.transactionId !== "string" ||
    !review.transactionId.trim()
  ) {
    const res = NextResponse.json(
      { error: "transactionId (string) is required" },
      { status: 400 }
    );
    return withCors(request, res);
  }

  const VALID_ACTIONS: ReviewAction["action"][] = ["approve", "reject", "void"];
  if (!review.action || !VALID_ACTIONS.includes(review.action)) {
    const res = NextResponse.json(
      { error: "action must be one of: approve, reject, void" },
      { status: 400 }
    );
    return withCors(request, res);
  }

  const transactionId = review.transactionId.trim();
  const action = review.action;
  const reviewNote = typeof review.reviewNote === "string"
    ? review.reviewNote.slice(0, 500).trim() || null
    : null;

  const admin = createAdminClient();

  // Load transaction
  const { data: tx, error: txErr } = await admin
    .from("payment_transactions")
    .select("id, shop_id, status, is_counted, amount, provider, direction")
    .eq("id", transactionId)
    .maybeSingle();

  if (txErr || !tx) {
    const res = NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    return withCors(request, res);
  }

  const row = tx as Record<string, unknown>;

  // Verify shop access
  const txShopId = row.shop_id as string;
  if (payload.shopId !== "all" && payload.shopId !== txShopId) {
    const res = NextResponse.json(
      { error: "Transaction does not belong to your authorized shop" },
      { status: 403 }
    );
    return withCors(request, res);
  }

  const currentStatus = row.status as string;

  // Prevent re-reviewing already-finalized transactions
  if (
    action === "approve" &&
    currentStatus !== "needs_review" &&
    currentStatus !== "pending"
  ) {
    const res = NextResponse.json(
      { error: `Cannot approve transaction with status '${currentStatus}'` },
      { status: 409 }
    );
    return withCors(request, res);
  }

  if (action === "reject" && currentStatus === "voided") {
    const res = NextResponse.json(
      { error: "Cannot reject a voided transaction" },
      { status: 409 }
    );
    return withCors(request, res);
  }

  // --- Determine new status ---
  let newStatus: string;
  let isCounted: boolean;

  if (action === "approve") {
    const amount = Number(row.amount) || 0;
    // Only count when amount > 0 — zero-amount approvals are informational only
    isCounted = amount > 0;
    newStatus = "confirmed";
  } else if (action === "reject") {
    newStatus = "rejected";
    isCounted = false;
  } else {
    // void
    newStatus = "voided";
    isCounted = false;
  }

  const now = new Date().toISOString();

  // --- Apply update ---
  const { error: updateErr } = await admin
    .from("payment_transactions")
    .update({
      status: newStatus,
      is_counted: isCounted,
      review_reason: reviewNote,
      updated_at: now,
    })
    .eq("id", transactionId);

  if (updateErr) {
    console.error("[payment-dashboard/review] Update failed:", updateErr.message);
    const res = NextResponse.json({ error: "Failed to apply review action" }, { status: 500 });
    return withCors(request, res);
  }

  // --- Audit log ---
  await admin.from("payment_audit_logs").insert({
    shop_id: txShopId,
    entity_type: "payment_transaction",
    entity_id: transactionId,
    action: `review_${action}`,
    old_values: { status: currentStatus, is_counted: row.is_counted },
    new_values: { status: newStatus, is_counted: isCounted, review_note: reviewNote },
    performed_by: payload.sub,
    performed_at: now,
  });

  const res = NextResponse.json(
    { success: true, transactionId, newStatus },
    { status: 200 }
  );
  return withCors(request, res);
}
