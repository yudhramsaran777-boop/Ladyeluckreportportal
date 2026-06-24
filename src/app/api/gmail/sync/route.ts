/**
 * POST /api/gmail/sync
 *
 * Triggers a manual Gmail sync for a specific connection.
 *
 * Request body:
 *   { connectionId: string }
 *
 * Response:
 *   { result: SyncResult }
 *
 * Rate limiting:
 *   - Database-level cooldown: gmail_connections.last_sync_attempt_at
 *     (globally reliable across all serverless instances)
 *   - In-memory cooldown: per-connection, per-instance
 *     (secondary guard; not globally reliable on multi-instance deployments)
 *   - Both gates must pass for the sync to proceed.
 *
 * Authorization: manager or owner portal session.
 * Manager: connection must belong to their shop.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireManagerOrOwner } from "@/lib/payment/portal-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailConnection } from "@/lib/payment/payment-ingestion";
import {
  checkInMemorySyncLimit,
  checkDbSyncCooldown,
  SYNC_COOLDOWN_SECONDS,
} from "@/lib/payment/rate-limiter";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrOwner();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const connectionId = (body as Record<string, unknown>)?.connectionId;
  if (typeof connectionId !== "string" || !connectionId.trim()) {
    return NextResponse.json(
      { error: "connectionId (string) is required" },
      { status: 400 }
    );
  }

  const connId = connectionId.trim();
  const admin = createAdminClient();

  // Load the connection — verify shop access and get last_sync_attempt_at
  const { data: conn, error: connErr } = await admin
    .from("gmail_connections")
    .select("id, shop_id, connection_status, last_sync_attempt_at")
    .eq("id", connId)
    .maybeSingle();

  if (connErr || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const row = conn as Record<string, unknown>;

  // Manager shop restriction
  if (user.role === "manager" && user.shopId && row.shop_id !== user.shopId) {
    return NextResponse.json(
      { error: "Connection does not belong to your shop" },
      { status: 403 }
    );
  }

  // Reject if connection is not in a syncsable state
  const status = row.connection_status as string;
  if (
    status !== "connected" &&
    status !== "token_expired" &&
    status !== "error"
  ) {
    return NextResponse.json(
      { error: `Connection is not active (status: ${status})` },
      { status: 409 }
    );
  }

  // --- Database-level rate limit (globally reliable) ---
  const dbCooldown = checkDbSyncCooldown(
    (row.last_sync_attempt_at as string | null) ?? null
  );
  if (!dbCooldown.allowed) {
    return NextResponse.json(
      {
        error: "Sync cooldown active",
        retryAfterSeconds: dbCooldown.retryAfterSeconds,
        message: `Please wait ${dbCooldown.retryAfterSeconds ?? SYNC_COOLDOWN_SECONDS} seconds before syncing again`,
      },
      { status: 429 }
    );
  }

  // --- In-memory rate limit (per-instance secondary guard) ---
  const memLimit = checkInMemorySyncLimit(connId);
  if (!memLimit.allowed) {
    return NextResponse.json(
      {
        error: "Sync cooldown active",
        retryAfterSeconds: memLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  // --- Run sync ---
  try {
    const result = await syncGmailConnection(connId, user.userId);
    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    console.error("[gmail/sync] Sync failed:", msg);
    return NextResponse.json(
      { error: "Sync failed", detail: msg },
      { status: 500 }
    );
  }
}
