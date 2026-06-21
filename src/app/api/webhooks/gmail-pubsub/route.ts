// ============================================================================
// Lady E Luck Portal — POST /api/webhooks/gmail-pubsub
//
// Receives Google Cloud Pub/Sub push notifications for new Gmail messages.
// Idempotent: same notification may be delivered multiple times.
//
// Security:
//   - Verifies the Bearer token in Authorization header matches
//     PUBSUB_WEBHOOK_SECRET (shared secret set in Google Cloud Pub/Sub subscription).
//   - No Supabase session is expected — this is a machine-to-machine endpoint.
//   - Returns 200 quickly to prevent Pub/Sub retry storms; heavy work is done
//     asynchronously (fire-and-forget via syncGmailConnection).
//
// Pub/Sub message structure:
//   { message: { data: base64(JSON({ emailAddress, historyId })), messageId }, subscription }
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailConnection } from "@/lib/payment/gmail-sync";

export const dynamic = "force-dynamic";

// 200 must be returned within 30s or Pub/Sub will retry.
// We acknowledge immediately and process asynchronously.
export async function POST(req: NextRequest) {
  // --- Authenticate the Pub/Sub push ---
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.PUBSUB_WEBHOOK_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Decode Pub/Sub message ---
  const message = (body as { message?: { data?: string; messageId?: string } }).message;
  if (!message?.data) {
    // Acknowledge empty messages to prevent retry loops
    return NextResponse.json({ ok: true });
  }

  let gmailAddress: string;
  let historyId: string;
  try {
    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
    gmailAddress = decoded.emailAddress;
    historyId = String(decoded.historyId);
    if (!gmailAddress || !historyId) throw new Error("missing fields");
  } catch {
    // Bad message format — acknowledge to prevent infinite retries
    console.warn("[gmail-pubsub] undecodable message:", message.data?.slice?.(0, 100));
    return NextResponse.json({ ok: true });
  }

  // --- Find the gmail_connection for this address ---
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("gmail_connections")
    .select("id, connection_status")
    .eq("email_address", gmailAddress.toLowerCase())
    .eq("connection_status", "connected")
    .maybeSingle();

  if (!connection) {
    // No active connection for this address — acknowledge and ignore
    return NextResponse.json({ ok: true });
  }

  // --- Acknowledge immediately; sync runs in background ---
  // waitUntil is not available in Next.js App Router without edge runtime,
  // so we fire-and-forget with .catch() to avoid unhandled rejections.
  syncGmailConnection({
    connectionId: connection.id,
    triggerType: "push_notification",
    startHistoryId: historyId,
  }).catch((err) => {
    console.error("[gmail-pubsub] async sync failed:", err);
  });

  return NextResponse.json({ ok: true });
}
