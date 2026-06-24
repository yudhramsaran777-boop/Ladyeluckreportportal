/**
 * POST /api/gmail/disconnect
 *
 * Disconnects a Gmail connection: revokes the encrypted tokens from the DB
 * and updates the connection status to 'disconnected'.
 *
 * Request body:
 *   { connectionId: string }
 *
 * Response:
 *   { success: true }
 *
 * SECURITY:
 *   - Requires manager or owner portal session.
 *   - Manager: connection must belong to their shop.
 *   - Owner: any connection.
 *   - Encrypted tokens are nulled out server-side — never returned.
 *   - Note: we do NOT call Google's token revocation endpoint here to avoid
 *     leaking the decrypted token in the request. The token simply becomes
 *     unusable once the DB record is cleared.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireManagerOrOwner } from "@/lib/payment/portal-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();

  // Load the connection to verify shop access
  const { data: conn, error: connErr } = await admin
    .from("gmail_connections")
    .select("id, shop_id, payment_account_id")
    .eq("id", connectionId.trim())
    .maybeSingle();

  if (connErr || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Manager shop restriction
  if (
    user.role === "manager" &&
    user.shopId &&
    (conn as Record<string, unknown>).shop_id !== user.shopId
  ) {
    return NextResponse.json(
      { error: "Connection does not belong to your shop" },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  const paymentAccountId = (conn as Record<string, unknown>).payment_account_id as string;

  // Clear encrypted tokens and mark disconnected
  const { error: updateErr } = await admin
    .from("gmail_connections")
    .update({
      encrypted_access_token: null,
      token_iv: null,
      encrypted_refresh_token: null,
      refresh_iv: null,
      token_expires_at: null,
      connection_status: "disconnected",
      disconnected_by: user.userId,
      disconnected_at: now,
      last_error_code: null,
      last_error_message: null,
      updated_at: now,
    })
    .eq("id", connectionId.trim());

  if (updateErr) {
    console.error("[gmail/disconnect] Update failed:", updateErr.message);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  // Update payment_accounts connection_status
  await admin
    .from("payment_accounts")
    .update({
      connection_status: "not_connected",
      updated_by: user.userId,
      updated_at: now,
    })
    .eq("id", paymentAccountId);

  // Audit log
  await admin.from("payment_audit_logs").insert({
    shop_id: (conn as Record<string, unknown>).shop_id as string,
    entity_type: "gmail_connection",
    entity_id: connectionId.trim(),
    action: "disconnected",
    new_values: { connection_status: "disconnected" },
    performed_by: user.userId,
    performed_at: now,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
