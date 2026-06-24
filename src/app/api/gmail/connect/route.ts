/**
 * POST /api/gmail/connect
 *
 * Initiates the Gmail OAuth flow for a payment account.
 *
 * Request body:
 *   { paymentAccountId: string }
 *
 * Response:
 *   { url: string }  — the Google OAuth authorization URL
 *
 * The caller (manager/owner portal page) redirects to the returned URL.
 * Google will redirect back to GOOGLE_OAUTH_REDIRECT_URI after consent.
 *
 * Authorization: manager or owner portal session (cookie-based).
 * Manager: payment account must belong to their shop.
 * Owner: any payment account.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireManagerOrOwner, verifyPaymentAccountAccess } from "@/lib/payment/portal-auth";
import { generateOAuthState, STATE_COOKIE_NAME, STATE_TTL_SECONDS } from "@/lib/payment/oauth-state";
import { buildAuthUrl } from "@/lib/payment/gmail-oauth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate the portal user
  const auth = await requireManagerOrOwner();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).paymentAccountId !== "string"
  ) {
    return NextResponse.json(
      { error: "paymentAccountId (string) is required" },
      { status: 400 }
    );
  }

  const paymentAccountId = ((body as Record<string, unknown>).paymentAccountId as string).trim();
  if (!paymentAccountId) {
    return NextResponse.json(
      { error: "paymentAccountId must not be empty" },
      { status: 400 }
    );
  }

  // 3. Verify the payment account belongs to the user's authorized shop
  const access = await verifyPaymentAccountAccess(user, paymentAccountId);
  if (!access.ok) return access.response;

  const { shopId } = access;

  // 4. Generate signed OAuth state token
  const stateToken = generateOAuthState({
    paymentAccountId,
    shopId,
    userId: user.userId,
  });

  // 5. Build the Google OAuth URL
  const authUrl = buildAuthUrl(stateToken);

  // 6. Set the state in an HttpOnly cookie (short-lived, path-restricted)
  const response = NextResponse.json({ url: authUrl }, { status: 200 });
  response.cookies.set(STATE_COOKIE_NAME, stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_TTL_SECONDS,
    path: "/api/gmail/callback",
  });

  return response;
}
