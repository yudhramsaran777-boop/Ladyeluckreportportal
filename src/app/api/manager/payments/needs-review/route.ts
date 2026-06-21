// ============================================================================
// Lady E Luck Portal — GET /api/manager/payments/needs-review
//                       POST /api/manager/payments/needs-review (review action)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { getNeedsReview, reviewTransaction } from "@/lib/payment/manager-queries";

export const dynamic = "force-dynamic";

async function getManagerProfile() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, shop_id")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.shop_id || profile.role === "employee") return null;
  return profile as { id: string; role: string; shop_id: string };
}

export async function GET() {
  const profile = await getManagerProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const rows = await getNeedsReview(profile.shop_id);
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const profile = await getManagerProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { transactionId, action } = body as { transactionId?: string; action?: string };

  if (!transactionId || !["confirm", "mark_duplicate", "mark_failed"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await reviewTransaction(
    transactionId,
    action as "confirm" | "mark_duplicate" | "mark_failed",
    profile.id,
    profile.shop_id
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
