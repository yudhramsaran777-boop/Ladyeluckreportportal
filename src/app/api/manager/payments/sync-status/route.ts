// ============================================================================
// Lady E Luck Portal — GET /api/manager/payments/sync-status
// Returns sync logs + gmail connections for manager Sync Status panel.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { getSyncLogs, getGmailConnections } from "@/lib/payment/manager-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.shop_id || profile.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const [syncLogs, connections] = await Promise.all([
    getSyncLogs(profile.shop_id, 30),
    getGmailConnections(profile.shop_id),
  ]);

  return NextResponse.json({ syncLogs, connections });
}
