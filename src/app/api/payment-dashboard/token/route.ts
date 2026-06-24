/**
 * POST /api/payment-dashboard/token
 *
 * Issues a short-lived signed Bearer token for the external payment dashboard.
 *
 * The dashboard (separate Artifact or app) cannot use Supabase session cookies
 * because it runs cross-origin. This endpoint validates the portal session and
 * issues a 15-minute Bearer token containing the user's identity and authorized
 * shop ID.
 *
 * Response:
 *   {
 *     token: string,           — Bearer token (valid 15 minutes)
 *     expiresAt: string,       — ISO timestamp
 *     shopId: string,          — authorized shop UUID (embedded in token)
 *     role: string             — user's role
 *   }
 *
 * The token encodes: sub (userId), role, shopId, iat, exp.
 * shopId is ALWAYS derived server-side from the portal session — never from
 * the request body.
 *
 * For owners: if a specific shopId is provided in the request body, it is
 * validated against the shops table. If not provided, the token covers all
 * shops (shopId = "all") — dashboard must handle this case.
 *
 * Authorization: manager or owner portal session (cookie-based).
 * No CORS needed — this endpoint is called from the portal (same origin).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireManagerOrOwner } from "@/lib/payment/portal-auth";
import { signDashboardToken } from "@/lib/payment/dashboard-token";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireManagerOrOwner();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  let shopId: string;

  if (user.role === "manager") {
    // Manager: shop_id is locked to their profile — never from request
    if (!user.shopId) {
      return NextResponse.json(
        { error: "Manager account has no assigned shop" },
        { status: 403 }
      );
    }
    shopId = user.shopId;
  } else {
    // Owner: may optionally specify a shop to scope the token
    let requestedShopId: string | undefined;
    try {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body?.shopId === "string" && body.shopId.trim()) {
        requestedShopId = body.shopId.trim();
      }
    } catch {
      // No body or invalid JSON — owner gets an "all" scope token
    }

    if (requestedShopId) {
      // Validate the requested shop exists
      const admin = createAdminClient();
      const { data: shop, error } = await admin
        .from("shops")
        .select("id")
        .eq("id", requestedShopId)
        .maybeSingle();

      if (error || !shop) {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }
      shopId = requestedShopId;
    } else {
      shopId = "all"; // Owner token covering all shops
    }
  }

  const token = signDashboardToken(user.userId, user.role, shopId);

  // Calculate expiry (15 minutes from now)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return NextResponse.json(
    {
      token,
      expiresAt,
      shopId,
      role: user.role,
    },
    { status: 200 }
  );
}
