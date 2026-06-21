// ============================================================================
// Lady E Luck Portal — GET /api/manager/payments/transactions
//
// Manager-only paginated transaction list with full fields.
// SECURITY: manager/owner only, shop_id from session.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { getManagerTransactions } from "@/lib/payment/manager-queries";
import type { ManagerTransactionFilters, ActivityType, TransactionStatus } from "@/lib/payment/payment-types";

export const dynamic = "force-dynamic";

const ACTIVITY_TYPES = ["incoming","outgoing","request_sent","request_received","refunded","failed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.shop_id) return NextResponse.json({ error: "No shop assigned" }, { status: 403 });
  if (profile.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const rawLimit = parseInt(sp.get("limit") ?? "50", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 50;

  const rawActivityType = sp.get("activity_type");
  const activityType = rawActivityType && ACTIVITY_TYPES.includes(rawActivityType)
    ? rawActivityType as ActivityType : null;

  const rawProvider = sp.get("provider");
  const provider = rawProvider === "CashApp" || rawProvider === "Chime" ? rawProvider : null;

  const rawStatus = sp.get("status");
  // allow known statuses through, otherwise null
  const validStatuses = ["confirmed","pending","failed","cancelled","canceled","refunded",
    "duplicate","needs_review","rejected","voided"];
  const status = rawStatus && validStatuses.includes(rawStatus) ? rawStatus as TransactionStatus : null;

  const rawStart = sp.get("date_start");
  const rawEnd = sp.get("date_end");
  const dateStart = rawStart && DATE_RE.test(rawStart) ? rawStart : null;
  const dateEnd = rawEnd && DATE_RE.test(rawEnd) ? rawEnd : null;

  const rawAmountMin = sp.get("amount_min");
  const rawAmountMax = sp.get("amount_max");
  const amountMin = rawAmountMin ? parseFloat(rawAmountMin) : null;
  const amountMax = rawAmountMax ? parseFloat(rawAmountMax) : null;

  const filters: ManagerTransactionFilters = {
    limit,
    cursor: sp.get("cursor") ?? null,
    provider,
    activityType,
    status,
    dateStart,
    dateEnd,
    accountId: sp.get("account_id") ?? null,
    searchTag: sp.get("search_tag")?.trim().slice(0, 100) ?? null,
    searchPlayer: sp.get("search_player")?.trim().slice(0, 100) ?? null,
    searchNote: sp.get("search_note")?.trim().slice(0, 100) ?? null,
    amountMin: amountMin != null && !isNaN(amountMin) ? amountMin : null,
    amountMax: amountMax != null && !isNaN(amountMax) ? amountMax : null,
  };

  const result = await getManagerTransactions(profile.shop_id, filters);
  return NextResponse.json(result);
}
