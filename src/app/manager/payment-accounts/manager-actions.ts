"use server";

// ============================================================================
// Lady E Luck Portal — Manager Payment Mapping Actions
// Phase 4: verifyPlayerMapping, markPlayerMappingNeedsReview,
//          blockPlayerMapping, deactivatePlayerMapping, correctPlayerMapping
//
// SECURITY RULES:
//   - All actions require manager or owner role.
//   - shop_id is ALWAYS derived from the authenticated user's profile.
//   - Owners may access all shops per existing owner rules.
//   - Employees are denied.
//   - All mutations are logged to payment_audit_logs.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PlayerMappingResult,
  EditPlayerMappingInput,
  VoidRechargeInput,
  VoidRechargeResult,
} from "@/lib/payment/payment-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLAYER_NAME   = 100;
const MAX_FACEBOOK_NAME = 100;
const MAX_GAME_USERNAME = 100;
const MAX_GAME_NAME     = 60;
const MAX_INTERNAL_NOTE = 500;
const MAX_REASON        = 500;

function isValidUUID(v: string): boolean {
  return UUID_RE.test(v);
}

// ---------------------------------------------------------------------------
// Local DB row interface (prevents GenericStringError)
// ---------------------------------------------------------------------------

interface MappingRow {
  id: string;
  shop_id: string;
  provider: string;
  payment_tag: string;
  normalized_payment_tag: string;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  internal_note: string | null;
  verification_status: string;
  status: string;
  added_by: string | null;
}

// ---------------------------------------------------------------------------
// Auth helper — returns { userId, shopId, role } or throws a safe error string
// ---------------------------------------------------------------------------

async function getManagerAuth(): Promise<{
  userId: string;
  shopId: string;
  role: string;
  supabase: ReturnType<typeof createClient>;
}> {
  const supabase = createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) throw "Not authenticated.";

  const userId = userData.user.id;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("shop_id, role")
    .eq("id", userId)
    .returns<{ shop_id: string; role: string }[]>()
    .single();

  const profile = profileData as { shop_id: string; role: string } | null;

  if (profileError || !profile?.shop_id) throw "No shop assigned to your account.";
  if (!["manager", "owner"].includes(profile.role))
    throw "Only managers and owners can perform this action.";

  return { userId, shopId: profile.shop_id, role: profile.role, supabase };
}

// ---------------------------------------------------------------------------
// Load and verify mapping ownership
// ---------------------------------------------------------------------------

async function loadAndVerifyMapping(
  supabase: ReturnType<typeof createClient>,
  mappingId: string,
  shopId: string,
  role: string
): Promise<MappingRow> {
  const { data: mappingData, error } = await supabase
    .from("player_payment_tags")
    .select(
      "id, shop_id, provider, payment_tag, normalized_payment_tag, " +
      "player_name, facebook_name, game_username, primary_game, internal_note, " +
      "verification_status, status, added_by"
    )
    .eq("id", mappingId)
    .returns<MappingRow[]>()
    .single();

  const mapping = mappingData as MappingRow | null;

  if (error || !mapping) throw "Mapping not found.";

  // Owners can access all shops; managers only their own
  if (role !== "owner" && mapping.shop_id !== shopId) {
    throw "Mapping does not belong to your shop.";
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// verifyPlayerMapping
// ---------------------------------------------------------------------------

export async function verifyPlayerMapping(
  mappingId: string
): Promise<PlayerMappingResult> {
  try {
    if (!mappingId || !isValidUUID(mappingId))
      return { success: false, error: "Invalid mapping ID." };

    const { userId, shopId, role, supabase } = await getManagerAuth();
    const mapping = await loadAndVerifyMapping(supabase, mappingId, shopId, role);

    if (mapping.status === "inactive")
      return { success: false, error: "Cannot verify an inactive mapping." };

    const { error } = await supabase
      .from("player_payment_tags")
      .update({
        verification_status: "manager_verified",
        verified_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", mappingId);

    if (error) {
      console.error("[manager-actions] verify error:", error.message);
      return { success: false, error: "Failed to verify mapping." };
    }

    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_verified",
      old_values: { verification_status: mapping.verification_status },
      new_values: { verification_status: "manager_verified", verified_by: userId },
      performed_by: userId,
    });

    return { success: true, mappingId, playerName: mapping.player_name ?? undefined };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] verifyPlayerMapping error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// markPlayerMappingNeedsReview
// ---------------------------------------------------------------------------

export async function markPlayerMappingNeedsReview(
  mappingId: string,
  reason: string
): Promise<PlayerMappingResult> {
  try {
    if (!mappingId || !isValidUUID(mappingId))
      return { success: false, error: "Invalid mapping ID." };
    if (!reason || reason.trim().length === 0)
      return { success: false, error: "A reason is required." };
    if (reason.trim().length > MAX_REASON)
      return { success: false, error: `Reason must be ${MAX_REASON} characters or fewer.` };

    const { userId, shopId, role, supabase } = await getManagerAuth();
    const mapping = await loadAndVerifyMapping(supabase, mappingId, shopId, role);

    const { error } = await supabase
      .from("player_payment_tags")
      .update({
        verification_status: "needs_review",
        manager_review_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", mappingId);

    if (error) {
      console.error("[manager-actions] needs_review error:", error.message);
      return { success: false, error: "Failed to flag mapping for review." };
    }

    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_needs_review",
      old_values: { verification_status: mapping.verification_status },
      new_values: {
        verification_status: "needs_review",
        manager_review_reason: reason.trim(),
      },
      performed_by: userId,
    });

    return { success: true, mappingId };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] markNeedsReview error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// blockPlayerMapping
// ---------------------------------------------------------------------------

export async function blockPlayerMapping(
  mappingId: string,
  reason: string
): Promise<PlayerMappingResult> {
  try {
    if (!mappingId || !isValidUUID(mappingId))
      return { success: false, error: "Invalid mapping ID." };
    if (!reason || reason.trim().length === 0)
      return { success: false, error: "A reason is required to block a mapping." };
    if (reason.trim().length > MAX_REASON)
      return { success: false, error: `Reason must be ${MAX_REASON} characters or fewer.` };

    const { userId, shopId, role, supabase } = await getManagerAuth();
    const mapping = await loadAndVerifyMapping(supabase, mappingId, shopId, role);

    const { error } = await supabase
      .from("player_payment_tags")
      .update({
        verification_status: "blocked",
        manager_review_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", mappingId);

    if (error) {
      console.error("[manager-actions] block error:", error.message);
      return { success: false, error: "Failed to block mapping." };
    }

    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_blocked",
      old_values: { verification_status: mapping.verification_status },
      new_values: {
        verification_status: "blocked",
        manager_review_reason: reason.trim(),
      },
      performed_by: userId,
    });

    return { success: true, mappingId };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] blockPlayerMapping error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// deactivatePlayerMapping
// ---------------------------------------------------------------------------

export async function deactivatePlayerMapping(
  mappingId: string
): Promise<PlayerMappingResult> {
  try {
    if (!mappingId || !isValidUUID(mappingId))
      return { success: false, error: "Invalid mapping ID." };

    const { userId, shopId, role, supabase } = await getManagerAuth();
    const mapping = await loadAndVerifyMapping(supabase, mappingId, shopId, role);

    if (mapping.status === "inactive")
      return { success: false, error: "Mapping is already inactive." };

    const { error } = await supabase
      .from("player_payment_tags")
      .update({
        status: "inactive",
        verification_status: "inactive",
        reviewed_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", mappingId);

    if (error) {
      console.error("[manager-actions] deactivate error:", error.message);
      return { success: false, error: "Failed to deactivate mapping." };
    }

    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_deactivated",
      old_values: {
        status: mapping.status,
        verification_status: mapping.verification_status,
      },
      new_values: { status: "inactive", verification_status: "inactive" },
      performed_by: userId,
    });

    return { success: true, mappingId };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] deactivatePlayerMapping error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// correctPlayerMapping
// ---------------------------------------------------------------------------

/**
 * Manager correction — updates player details.
 * Sets verification_status back to manager_verified after correction.
 * Does NOT change shop_id, provider, or payment_tag.
 */
export async function correctPlayerMapping(
  input: EditPlayerMappingInput
): Promise<PlayerMappingResult> {
  try {
    const {
      mappingId,
      playerName,
      facebookName,
      gameUsername,
      primaryGame,
      internalNote,
    } = input;

    if (!mappingId || !isValidUUID(mappingId))
      return { success: false, error: "Invalid mapping ID." };
    if (!playerName || playerName.trim().length === 0)
      return { success: false, error: "Player name is required." };
    if (playerName.trim().length > MAX_PLAYER_NAME)
      return { success: false, error: `Player name must be ${MAX_PLAYER_NAME} characters or fewer.` };
    if (facebookName && facebookName.length > MAX_FACEBOOK_NAME)
      return { success: false, error: `Facebook name must be ${MAX_FACEBOOK_NAME} characters or fewer.` };
    if (gameUsername && gameUsername.length > MAX_GAME_USERNAME)
      return { success: false, error: `Game username must be ${MAX_GAME_USERNAME} characters or fewer.` };
    if (primaryGame && primaryGame.length > MAX_GAME_NAME)
      return { success: false, error: `Game name must be ${MAX_GAME_NAME} characters or fewer.` };
    if (internalNote && internalNote.length > MAX_INTERNAL_NOTE)
      return { success: false, error: `Note must be ${MAX_INTERNAL_NOTE} characters or fewer.` };

    const { userId, shopId, role, supabase } = await getManagerAuth();
    const mapping = await loadAndVerifyMapping(supabase, mappingId, shopId, role);

    const oldValues = {
      player_name: mapping.player_name,
      facebook_name: mapping.facebook_name,
      game_username: mapping.game_username,
      primary_game: mapping.primary_game,
      internal_note: mapping.internal_note,
      verification_status: mapping.verification_status,
    };

    const { error } = await supabase
      .from("player_payment_tags")
      .update({
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        internal_note: internalNote?.trim() || null,
        verification_status: "manager_verified",
        verified_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", mappingId);

    if (error) {
      console.error("[manager-actions] correct error:", error.message);
      return { success: false, error: "Failed to correct mapping." };
    }

    // Update any linked transactions with corrected player info
    const admin = createAdminClient();
    await admin
      .from("payment_transactions")
      .update({ updated_at: new Date().toISOString() })
      .eq("player_mapping_id", mappingId);

    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_verified",
      old_values: oldValues,
      new_values: {
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        internal_note: internalNote?.trim() || null,
        verification_status: "manager_verified",
      },
      performed_by: userId,
    });

    return {
      success: true,
      mappingId,
      playerName: playerName.trim(),
    };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] correctPlayerMapping error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ---------------------------------------------------------------------------
// voidRecharge
// ---------------------------------------------------------------------------

/**
 * Void an incorrect recharge record.
 *
 * SECURITY:
 *   - Manager or owner only.
 *   - shop_id is derived from the authenticated profile.
 *   - Voiding sets voided_at + voided_by and logs the action.
 *   - The original record is NEVER deleted (audit history is preserved).
 *   - After voiding, a corrected recharge may be submitted (the unique partial
 *     index allows a new active recharge once voided_at is set).
 */

interface RechargeVerifyRow {
  id: string;
  shop_id: string;
  payment_transaction_id: string;
  recharge_status: string;
  voided_at: string | null;
  cash_received: string | number;
  coins_recharged: string | number;
  bonus_given: string | number;
  missing_recharge: string | number;
  employee_id: string | null;
}

export async function voidRecharge(
  input: VoidRechargeInput
): Promise<VoidRechargeResult> {
  try {
    const { rechargeId, reason } = input;

    if (!rechargeId || !isValidUUID(rechargeId)) {
      return { success: false, error: "Invalid recharge ID." };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "A reason is required to void a recharge." };
    }
    if (reason.trim().length > MAX_REASON) {
      return { success: false, error: `Reason must be ${MAX_REASON} characters or fewer.` };
    }

    const { userId, shopId, role, supabase } = await getManagerAuth();

    // Load the recharge record
    const { data: rechargeData, error: rechargeError } = await supabase
      .from("payment_recharges")
      .select(
        "id, shop_id, payment_transaction_id, recharge_status, voided_at, " +
        "cash_received, coins_recharged, bonus_given, missing_recharge, employee_id"
      )
      .eq("id", rechargeId)
      .returns<RechargeVerifyRow[]>()
      .single();

    const recharge = rechargeData as RechargeVerifyRow | null;

    if (rechargeError || !recharge) {
      return { success: false, error: "Recharge record not found." };
    }

    // Shop isolation — owners can access all shops
    if (role !== "owner" && recharge.shop_id !== shopId) {
      return { success: false, error: "Recharge does not belong to your shop." };
    }

    // Already voided
    if (recharge.voided_at !== null) {
      return { success: false, error: "This recharge has already been voided." };
    }

    const now = new Date().toISOString();

    // Void the recharge (update, not delete — history must be preserved)
    const { error: updateError } = await supabase
      .from("payment_recharges")
      .update({
        voided_at: now,
        voided_by: userId,
        recharge_status: "voided",
        notes: recharge.recharge_status !== "voided"
          ? `[VOIDED: ${reason.trim()}]`
          : undefined,
      })
      .eq("id", rechargeId);

    if (updateError) {
      console.error("[manager-actions] voidRecharge update error:", updateError.message);
      return { success: false, error: "Failed to void recharge." };
    }

    // Audit log
    await supabase.from("payment_audit_logs").insert({
      shop_id: recharge.shop_id,
      entity_type: "payment_recharge",
      entity_id: rechargeId,
      action: "recharge_voided",
      old_values: {
        recharge_status: recharge.recharge_status,
        cash_received: Number(recharge.cash_received),
        coins_recharged: Number(recharge.coins_recharged),
        bonus_given: Number(recharge.bonus_given),
        missing_recharge: Number(recharge.missing_recharge),
      },
      new_values: {
        recharge_status: "voided",
        voided_by: userId,
        void_reason: reason.trim(),
        voided_at: now,
      },
      performed_by: userId,
    });

    return { success: true, rechargeId };
  } catch (err) {
    if (typeof err === "string") return { success: false, error: err };
    console.error("[manager-actions] voidRecharge error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
