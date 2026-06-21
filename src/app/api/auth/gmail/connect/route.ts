// ============================================================================
// Lady E Luck Portal — GET /api/auth/gmail/connect
//
// Initiates Gmail OAuth flow. Manager/owner only.
// Redirects the browser to Google's OAuth consent screen.
//
// Query params required:
//   payment_account_id  — UUID of the payment_accounts row to link
//
// Security:
//   - Authenticated manager/owner only (401/403 otherwise).
//   - State param encodes shop_id + user_id + payment_account_id
//     and is verified in /api/auth/gmail/callback.
//   - Uses PKCE via state nonce stored in a short-lived HTTP-only cookie.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile || !["owner", "manager"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.shop_id) {
    return NextResponse.json({ error: "No shop assigned" }, { status: 403 });
  }

  const paymentAccountId = req.nextUrl.searchParams.get("payment_account_id");
  if (!paymentAccountId) {
    return NextResponse.json(
      { error: "payment_account_id is required" },
      { status: 400 }
    );
  }

  // Verify the payment_account_id belongs to this manager's shop
  const { data: account } = await admin
    .from("payment_accounts")
    .select("id, shop_id")
    .eq("id", paymentAccountId)
    .eq("shop_id", profile.shop_id)
    .single();

  if (!account) {
    return NextResponse.json(
      { error: "Payment account not found" },
      { status: 404 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  // Encode state: shop_id|user_id|payment_account_id + nonce
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const statePayload = `${profile.shop_id}|${userData.user.id}|${paymentAccountId}|${nonce}`;
  const state = Buffer.from(statePayload).toString("base64url");

  // Store nonce in HTTP-only cookie (15-min TTL)
  const cookieStore = cookies();
  cookieStore.set("gmail_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900, // 15 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent", // Force refresh_token to be returned every time
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
