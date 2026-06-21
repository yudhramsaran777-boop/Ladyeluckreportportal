// ============================================================================
// Lady E Luck Portal — GET /api/cron/gmail-reconcile
//
// Fallback reconciliation: syncs all connected Gmail accounts to catch
// any messages missed due to failed Pub/Sub push notifications.
// Triggered hourly by Vercel cron or external scheduler.
//
// Security: requires CRON_SECRET Bearer token.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailConnection } from "@/lib/payment/gmail-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find all connected Gmail accounts
  const { data: connections } = await admin
    .from("gmail_connections")
    .select("id")
    .eq("connection_status", "connected");

  if (!connections?.length) {
    return NextResponse.json({ ok: true, message: "No connected accounts", synced: 0 });
  }

  let synced = 0;
  let errors = 0;

  for (const conn of connections) {
    try {
      await syncGmailConnection({
        connectionId: conn.id,
        triggerType: "reconciliation",
      });
      synced++;
    } catch (err) {
      console.error(`[reconcile] connection ${conn.id} failed:`, err);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, synced, errors });
}
