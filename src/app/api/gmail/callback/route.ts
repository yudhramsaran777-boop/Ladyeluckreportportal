/**
 * GET /api/gmail/callback
 *
 * Google OAuth 2.0 callback handler.
 *
 * Google redirects here after the user grants/denies Gmail access.
 * Query parameters: code, state, error (on denial)
 *
 * On success:
 *   1. Verify state token against cookie (CSRF protection)
 *   2. Exchange authorization code for tokens
 *   3. Encrypt and store tokens in gmail_connections
 *   4. Redirect to /gmail-connect-result?status=success
 *
 * On failure:
 *   Redirect to /gmail-connect-result?status=error
 *
 * SECURITY:
 *   - State is verified against HttpOnly cookie before any action
 *   - Authorization code is never logged or returned to the browser
 *   - Tokens are AES-256-GCM encrypted before storage
 *   - Raw tokens are never stored in the DB or returned in responses
 *   - shopId and paymentAccountId come from the verified state token (server-side)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyOAuthState, STATE_COOKIE_NAME } from "@/lib/payment/oauth-state";
import { exchangeCodeForTokens } from "@/lib/payment/gmail-oauth";
import { storeEncryptedToken } from "@/lib/payment/token-encryption";
import { createAdminClient } from "@/lib/supabase/admin";

const RESULT_PAGE = "/gmail-connect-result";

function redirectResult(
  baseUrl: string,
  status: "success" | "error",
  reason?: string
): NextResponse {
  const url = new URL(RESULT_PAGE, baseUrl);
  url.searchParams.set("status", status);
  if (reason) {
    // Only set a generic reason code — never expose OAuth details or secrets
    url.searchParams.set("reason", reason);
  }
  const res = NextResponse.redirect(url.toString());
  // Clear the state cookie
  res.cookies.set(STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/gmail/callback",
  });
  return res;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Handle user denial or OAuth error
  if (oauthError || !code || !stateParam) {
    return redirectResult(baseUrl, "error", oauthError ?? "missing_params");
  }

  // --- Verify state against HttpOnly cookie ---
  const cookieState = request.cookies.get(STATE_COOKIE_NAME)?.value;
  if (!cookieState) {
    return redirectResult(baseUrl, "error", "missing_state_cookie");
  }

  if (cookieState !== stateParam) {
    return redirectResult(baseUrl, "error", "state_mismatch");
  }

  let statePayload;
  try {
    statePayload = verifyOAuthState(stateParam);
  } catch {
    return redirectResult(baseUrl, "error", "invalid_state");
  }

  const { paymentAccountId, shopId, userId } = statePayload;

  try {
    // --- Exchange code for tokens ---
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // refresh_token is only returned on first authorization or after
      // revoking access. The prompt=consent in the auth URL should guarantee it.
      return redirectResult(baseUrl, "error", "no_refresh_token");
    }

    // --- Encrypt tokens ---
    const { iv: accessIv, tagAndData: encryptedAccess } = storeEncryptedToken(
      tokens.access_token
    );
    const { iv: refreshIv, tagAndData: encryptedRefresh } = storeEncryptedToken(
      tokens.refresh_token
    );

    const tokenExpiresAt = new Date(
      Date.now() + (tokens.expires_in - 60) * 1000 // subtract 60s buffer
    ).toISOString();

    // --- Upsert gmail_connections row ---
    // If a connection already exists for this payment account, update it.
    // Otherwise, insert a new one.
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("gmail_connections")
      .select("id")
      .eq("payment_account_id", paymentAccountId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      await admin
        .from("gmail_connections")
        .update({
          encrypted_access_token: encryptedAccess,
          token_iv: accessIv,
          encrypted_refresh_token: encryptedRefresh,
          refresh_iv: refreshIv,
          token_expires_at: tokenExpiresAt,
          connection_status: "connected",
          connected_by: userId,
          connected_at: now,
          disconnected_by: null,
          disconnected_at: null,
          last_error_code: null,
          last_error_message: null,
          updated_at: now,
        })
        .eq("id", (existing as { id: string }).id);
    } else {
      await admin.from("gmail_connections").insert({
        shop_id: shopId,
        payment_account_id: paymentAccountId,
        email_address: "", // will be populated on first sync when we know the Gmail address
        encrypted_access_token: encryptedAccess,
        token_iv: accessIv,
        encrypted_refresh_token: encryptedRefresh,
        refresh_iv: refreshIv,
        token_expires_at: tokenExpiresAt,
        connection_status: "connected",
        connected_by: userId,
        connected_at: now,
      });
    }

    // --- Update payment_accounts connection_status ---
    await admin
      .from("payment_accounts")
      .update({
        connection_status: "connected",
        updated_by: userId,
        updated_at: now,
      })
      .eq("id", paymentAccountId);

    return redirectResult(baseUrl, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    // Log server-side for debugging (never expose to browser)
    console.error("[gmail/callback] Token exchange or storage failed:", msg);
    return redirectResult(baseUrl, "error", "server_error");
  }
}
