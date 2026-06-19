// ============================================================================
// Lady E Luck Portal - GET /api/payment/transactions
// Phase 3: Employee individual-payment API endpoint
//
// SECURITY RULES:
//   - shop_id is ALWAYS read from the authenticated user's profile row.
//     It is NEVER accepted from request query params or body.
//   - Only EmployeePaymentTransaction[] is returned - no aggregate totals,
//     no token fields, no credentials of any kind.
//   - Unauthenticated requests → 401.
//   - Authenticated users with no shop assigned → 403.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEmployeeTransactions,
  type GetTransactionsParams,
} from "@/lib/payment/payment-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ---- Authentication -------------------------------------------------------
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Derive shop_id from authenticated profile (NEVER from request params) -
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile?.shop_id) {
    return NextResponse.json(
      { error: "No shop assigned to your account" },
      { status: 403 }
    );
  }

  const shopId: string = profile.shop_id;

  // ---- Parse filter params (shop_id is NOT accepted from params) -----------
  const sp = req.nextUrl.searchParams;

  const rawLimit = parseInt(sp.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 50) : 20;

  const rawProvider = sp.get("provider");
  const provider: GetTransactionsParams["provider"] =
    rawProvider === "CashApp" || rawProvider === "Chime" ? rawProvider : null;

  const rawDirection = sp.get("direction");
  const direction: GetTransactionsParams["direction"] =
    rawDirection === "received" || rawDirection === "sent" ? rawDirection : null;

  const rawPlayerMatch = sp.get("player_match");
  const playerMatch: GetTransactionsParams["playerMatch"] =
    rawPlayerMatch === "matched" ||
    rawPlayerMatch === "unmatched" ||
    rawPlayerMatch === "needs_review"
      ? rawPlayerMatch
      : null;

  const rawRecharged = sp.get("recharged");
  const recharged: GetTransactionsParams["recharged"] =
    rawRecharged === "true" ? true : rawRecharged === "false" ? false : null;

  // Basic date validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const rawDateStart = sp.get("date_start");
  const rawDateEnd = sp.get("date_end");
  const dateStart = rawDateStart && dateRegex.test(rawDateStart) ? rawDateStart : null;
  const dateEnd = rawDateEnd && dateRegex.test(rawDateEnd) ? rawDateEnd : null;

  // Cursor must be a valid ISO timestamp
  const rawCursor = sp.get("cursor");
  const cursor = rawCursor ? rawCursor : null;

  // Free-text search params (trimmed, max 100 chars)
  const searchTag = sp.get("search_tag")?.trim().slice(0, 100) || null;
  const searchPlayer = sp.get("search_player")?.trim().slice(0, 100) || null;

  // ---- Query ---------------------------------------------------------------
  const result = await getEmployeeTransactions(shopId, {
    limit,
    cursor,
    provider,
    direction,
    playerMatch,
    recharged,
    searchTag,
    searchPlayer,
    dateStart,
    dateEnd,
  });

  // Return ONLY the employee-safe response shape
  return NextResponse.json({
    data: result.data,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  });
}
