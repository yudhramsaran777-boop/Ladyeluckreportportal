// ============================================================================
// Lady E Luck Portal — GET /api/cron/gmail-watch-renewal
//
// Renews Gmail Pub/Sub watches that are expiring within 24 hours.
// Triggered by a Vercel cron or external scheduler (daily).
//
// Security: requires CRON_SECRET Bearer token.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { renewGmailWatches } from "@/lib/payment/gmail-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await renewGmailWatches();
    return NextResponse.json({ ok: true, message: "Watch renewal completed" });
  } catch (err) {
    console.error("[cron/gmail-watch-renewal] error:", err);
    return NextResponse.json({ error: "Renewal failed" }, { status: 500 });
  }
}
