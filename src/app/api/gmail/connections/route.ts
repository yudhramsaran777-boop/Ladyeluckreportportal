/**
 * GET /api/gmail/connections
 *
 * Returns Gmail connection status for all payment accounts in the user's shop.
 *
 * Response: { connections: DashboardConnection[] }
 *
 * SECURITY:
 *   - Requires manager or owner portal session.
 *   - Manager: returns connections for their shop only.
 *   - Owner: returns all connections (no shop restriction).
 *   - Encrypted tokens are excluded at the query level — never returned.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireManagerOrOwner } from "@/lib/payment/portal-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardConnection } from "@/lib/payment/dashboard-types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrOwner();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const admin = createAdminClient();

  // Select only metadata columns — tokens are explicitly excluded
  let query = admin
    .from("gmail_connections")
    .select(
      "id, shop_id, payment_account_id, email_address, connection_status, " +
      "last_synced_at, last_sync_attempt_at, last_error_code, last_error_message, " +
      "connected_at"
    )
    .order("created_at", { ascending: false });

  // Managers are scoped to their shop
  if (user.role === "manager" && user.shopId) {
    query = query.eq("shop_id", user.shopId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[gmail/connections] Query failed:", error.message);
    return NextResponse.json({ error: "Failed to load connections" }, { status: 500 });
  }

  interface ConnectionRow {
    id: string;
    shop_id: string;
    payment_account_id: string;
    email_address: string;
    connection_status: string;
    last_synced_at: string | null;
    last_sync_attempt_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    connected_at: string | null;
  }

  const rows = (data ?? []) as unknown as ConnectionRow[];
  const connections: DashboardConnection[] = rows.map((row) => ({
    id: row.id,
    shopId: row.shop_id,
    paymentAccountId: row.payment_account_id,
    emailAddress: row.email_address,
    connectionStatus: row.connection_status,
    lastSyncedAt: row.last_synced_at,
    lastSyncAttemptAt: row.last_sync_attempt_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    connectedAt: row.connected_at,
  }));

  return NextResponse.json({ connections }, { status: 200 });
}