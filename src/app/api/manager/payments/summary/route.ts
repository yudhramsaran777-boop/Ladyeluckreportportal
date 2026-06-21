// ============================================================================
// Lady E Luck Portal — GET /api/manager/payments/summary
//
// SECURITY:
//   - manager or owner role required (403 for employees)
//   - shop_id derived from authenticated profile, NEVER from request params
//   - Returns ManagerPaymentTotals — never sent to employees
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { getManagerPaymentTotals } from "@/lib/payment/manager-queries";

export const dynamic = "force-dynamic";

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
  const today = new Date().toISOString().slice(0, 10);
  const start = sp.get("start") ?? today;
  const end = sp.get("end") ?? today;

  const totals = await getManagerPaymentTotals(profile.shop_id, start, end);
  return NextResponse.json(totals);
}
