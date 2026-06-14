"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/constants";

export interface CreateUserByOwnerInput {
  email: string;
  password: string;
  fullName: string;
  role: "manager" | "employee";
  shopId?: string | null;
  isActive?: boolean;
}

export interface CreateUserByOwnerResult {
  success: boolean;
  message: string;
}

export async function createUserByOwner(
  input: CreateUserByOwnerInput
): Promise<CreateUserByOwnerResult> {
  const { email, password, fullName, role, shopId, isActive = true } = input;

  if (!email || !password || !fullName) {
    return { success: false, message: "Email, password, and full name are required." };
  }
  if (role !== "manager" && role !== "employee") {
    return { success: false, message: "Invalid role." };
  }

  // Verify the current user is an owner using the regular server client
  // (subject to RLS / cookies for the logged-in session).
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { success: false, message: "Not authenticated." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "owner") {
    return { success: false, message: "Only the owner can create user accounts." };
  }

  // Use the admin client (service role key) to create the auth user.
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return { success: false, message: createError?.message || "Failed to create user." };
  }

  const newUserId = created.user.id;

  // Insert/update the profile row.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        email,
        full_name: fullName,
        role,
        shop_id: shopId || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return { success: false, message: `User created, but profile update failed: ${profileError.message}` };
  }

  // If a shop is assigned, also create a shop_members row.
  if (shopId) {
    const { error: memberError } = await admin.from("shop_members").insert({
      shop_id: shopId,
      user_id: newUserId,
      role,
      is_active: isActive,
    });

    if (memberError) {
      return {
        success: true,
        message: `${role === "manager" ? "Manager" : "Employee"} account created, but shop assignment failed: ${memberError.message}`,
      };
    }
  }

  return {
    success: true,
    message: `${role === "manager" ? "Manager" : "Employee"} account created successfully.`,
  };
}

export type { Role };
