/**
 * Portal session authentication helper for Gmail/dashboard API routes.
 * SERVER-ONLY.
 *
 * Validates the Supabase session cookie, fetches the user's profile from the
 * `profiles` table, and enforces manager-or-owner-only access.
 *
 * Authorization rules for portal Gmail routes:
 *   - Must have a valid Supabase session cookie
 *   - Role must be 'manager' or 'owner'
 *   - Profile must be active
 *   - Manager: shop_id is derived from profiles — never trusted from the browser
 *   - Owner: shop_id is null (owners see all shops); shop access resolved per-route
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/constants";

export interface PortalUser {
  userId: string;
  role: Role;
  /** For managers: their assigned shop_id. For owners: null (access all). */
  shopId: string | null;
  email: string;
}

export type PortalAuthResult =
  | { ok: true; user: PortalUser }
  | { ok: false; response: NextResponse };

/**
 * Require a valid portal session with manager or owner role.
 *
 * Usage in a Route Handler:
 *   const auth = await requireManagerOrOwner();
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
export async function requireManagerOrOwner(): Promise<PortalAuthResult> {
  // 1. Validate the Supabase session using the cookie-based server client
  const supabase = createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  // 2. Fetch the profile using the admin client for reliable server-side access.
  //    We use admin here because: (a) it bypasses RLS for guaranteed read,
  //    (b) the session client's RLS policies allow self-read anyway, but admin
  //    ensures we always get the row even in edge cases.
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, role, shop_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      ),
    };
  }

  // 3. Enforce active status
  if (!profile.is_active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 }
      ),
    };
  }

  // 4. Enforce manager-or-owner role
  const role = profile.role as Role;
  if (role !== "manager" && role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Manager or owner access required" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      userId: user.id,
      role,
      shopId: (profile.shop_id as string | null) ?? null,
      email: (profile.email as string | null) ?? "",
    },
  };
}

/**
 * Verify that a given payment_account_id belongs to the user's authorized shop.
 *
 * For managers: payment_accounts.shop_id must equal profiles.shop_id.
 * For owners: all payment accounts are accessible (no shop restriction).
 *
 * Returns the shop_id associated with the payment account, or an error response.
 */
export async function verifyPaymentAccountAccess(
  user: PortalUser,
  paymentAccountId: string
): Promise<
  | { ok: true; shopId: string }
  | { ok: false; response: NextResponse }
> {
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("payment_accounts")
    .select("id, shop_id")
    .eq("id", paymentAccountId)
    .maybeSingle();

  if (error || !account) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payment account not found" },
        { status: 404 }
      ),
    };
  }

  const accountShopId = account.shop_id as string;

  // Managers: their shop_id must match the account's shop_id
  if (user.role === "manager") {
    if (!user.shopId || user.shopId !== accountShopId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Payment account does not belong to your shop" },
          { status: 403 }
        ),
      };
    }
  }
  // Owners: no shop restriction

  return { ok: true, shopId: accountShopId };
}
