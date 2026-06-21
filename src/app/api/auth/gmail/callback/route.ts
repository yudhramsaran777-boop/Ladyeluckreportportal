// ============================================================================
// Lady E Luck Portal — GET /api/auth/gmail/callback
//
// Handles Google OAuth callback. Exchanges code for tokens, encrypts the
// refresh token, stores in gmail_connections, starts Gmail watch.
//
// Security:
//   - Verifies state nonce matches the HTTP-only cookie set in /connect.
//   - Validates that the authenticated user still has manager/owner role.
//   - Never exposes tokens to the browser — stores encrypted server-side.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/payment/gmail-crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createClient();
  const admin = createAdminClient();

  // --- Auth check ---
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "manager"].includes(profile.role ?? "")) {
    return NextResponse.redirect(
      new URL("/manager/payment-accounts?error=forbidden", req.url)
    );
  }

  // --- Validate OAuth response ---
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");

  if (oauthError || !code || !state) {
    const err = oauthError ?? "missing_code";
    return NextResponse.redirect(
      new URL(`/manager/payment-accounts?error=oauth_${err}`, req.url)
    );
  }

  // Decode and verify state nonce
  let shopId: string, userId: string, paymentAccountId: string, nonce: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    [shopId, userId, paymentAccountId, nonce] = decoded.split("|");
  } catch {
    return NextResponse.redirect(
      new URL("/manager/payment-accounts?error=invalid_state", req.url)
    );
  }

  const storedNonce = cookieStore.get("gmail_oauth_nonce")?.value;
  if (!storedNonce || storedNonce !== nonce || userId !== userData.user.id) {
    return NextResponse.redirect(
      new URL("/manager/payment-accounts?error=state_mismatch", req.url)
    );
  }

  // Clear the nonce cookie
  cookieStore.set("gmail_oauth_nonce", "", { maxAge: 0, path: "/" });

  // --- Exchange code for tokens ---
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  let accessToken: string, refreshToken: string, expiresIn: number;
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description ?? "token_exchange_failed");
    }
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresIn = tokenData.expires_in ?? 3600;
    if (!refreshToken) {
      throw new Error("no_refresh_token — ensure prompt=consent was sent");
    }
  } catch (err) {
    console.error("[gmail-callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/manager/payment-accounts?error=token_exchange", req.url)
    );
  }

  // --- Fetch Gmail address from userinfo ---
  let gmailAddress: string;
  try {
    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const info = await infoRes.json();
    gmailAddress = info.email;
    if (!gmailAddress) throw new Error("no_email_in_userinfo");
  } catch (err) {
    console.error("[gmail-callback] userinfo fetch failed:", err);
    return NextResponse.redirect(
      new URL("/manager/payment-accounts?error=userinfo_failed", req.url)
    );
  }

  // --- Encrypt tokens ---
  const { ciphertext: encRefresh, iv: refreshIv } = encryptToken(refreshToken);
  const { ciphertext: encAccess, iv: accessIv } = encryptToken(accessToken);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // --- Upsert gmail_connections row ---
  const { data: existingConn } = await admin
    .from("gmail_connections")
    .select("id")
    .eq("payment_account_id", paymentAccountId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (existingConn) {
    await admin
      .from("gmail_connections")
      .update({
        email_address: gmailAddress,
        encrypted_access_token: encAccess,
        token_iv: accessIv,
        encrypted_refresh_token: encRefresh,
        refresh_iv: refreshIv,
        token_expires_at: tokenExpiresAt,
        connection_status: "connected",
        last_error_code: null,
        last_error_message: null,
        connected_by: userData.user.id,
        connected_at: new Date().toISOString(),
        disconnected_by: null,
        disconnected_at: null,
      })
      .eq("id", existingConn.id);
  } else {
    await admin.from("gmail_connections").insert({
      shop_id: shopId,
      payment_account_id: paymentAccountId,
      email_address: gmailAddress,
      encrypted_access_token: encAccess,
      token_iv: accessIv,
      encrypted_refresh_token: encRefresh,
      refresh_iv: refreshIv,
      token_expires_at: tokenExpiresAt,
      connection_status: "connected",
      connected_by: userData.user.id,
      connected_at: new Date().toISOString(),
    });
  }

  // Also update payment_accounts.connection_status
  await admin
    .from("payment_accounts")
    .update({
      connection_status: "connected",
      last_synced_at: null,
      updated_by: userData.user.id,
    })
    .eq("id", paymentAccountId);

  // --- Start Gmail watch (Pub/Sub) ---
  // Fire-and-forget — failure here doesn't block the connect flow.
  // The reconciliation job will catch up if watch setup fails.
  try {
    await setupGmailWatch({ accessToken, gmailAddress, shopId, paymentAccountId, admin });
  } catch (err) {
    console.error("[gmail-callback] watch setup failed (non-fatal):", err);
  }

  return NextResponse.redirect(
    new URL("/manager/payment-accounts?connected=1", req.url)
  );
}

// ---------------------------------------------------------------------------
// Setup Gmail push notification watch via Pub/Sub
// ---------------------------------------------------------------------------

async function setupGmailWatch({
  accessToken,
  gmailAddress,
  shopId,
  paymentAccountId,
  admin,
}: {
  accessToken: string;
  gmailAddress: string;
  shopId: string;
  paymentAccountId: string;
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;
}) {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    console.warn("[gmail-callback] GOOGLE_PUBSUB_TOPIC not set — watch skipped");
    return;
  }

  const watchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${gmailAddress}/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      }),
    }
  );

  const watchData = await watchRes.json();
  if (!watchRes.ok || !watchData.historyId) {
    throw new Error(`watch failed: ${JSON.stringify(watchData)}`);
  }

  const watchExpires = new Date(parseInt(watchData.expiration)).toISOString();

  // Update the connection with watch state
  await admin
    .from("gmail_connections")
    .update({
      last_history_id: String(watchData.historyId),
      watch_expires_at: watchExpires,
    })
    .eq("payment_account_id", paymentAccountId)
    .eq("shop_id", shopId);
}
