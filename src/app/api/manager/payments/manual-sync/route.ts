// ============================================================================
// Lady E Luck Portal — POST /api/manager/payments/manual-sync
// Triggers an on-demand Gmail sync for a specific connection (manager/owner).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { syncGmailConnection } from "@/lib/payment/gmail-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
  if (!flags.gmail_sync_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { connectionId } = body as { connectionId?: string };
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  // Verify connection belongs to this manager's shop
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("gmail_connections")
    .select("id, shop_id")
    .eq("id", connectionId)
    .single();

  if (!conn || conn.shop_id !== profile.shop_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fire sync — manager waits for result (unlike Pub/Sub which is fire-and-forget)
  const result = await syncGmailConnection({
    connectionId,
    triggerType: "manual",
  });

  return NextResponse.json(result);
}
