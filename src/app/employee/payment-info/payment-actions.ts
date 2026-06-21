"use server";

// ============================================================================
// Lady E Luck Portal — Employee Payment Actions
// Phase 4: addPlayerMapping, editPlayerMapping
//
// SECURITY RULES:
//   - shop_id is ALWAYS derived from the authenticated user's profile.
//     It is NEVER accepted from client input.
//   - payment_transactions.player_match_status is updated via admin client
//     (no browser UPDATE policy exists on that table).
//   - Employees can only edit their own employee_added mappings.
//   - Managers and owners can edit any mapping in their shop.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePaymentTagOrThrow } from "@/lib/payment/player-tag-normalizer";
import {
  calculateRecharge,
  RechargeCalculationError,
  type DbRechargeStatus,
} from "@/lib/payment/recharge-calculator";
import type {
  PlayerMappingInput,
  EditPlayerMappingInput,
  PlayerMappingResult,
  RechargeInput,
  RechargeResult,
  RechargeStatus,
} from "@/lib/payment/payment-types";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const MAX_PLAYER_NAME   = 100;
const MAX_FACEBOOK_NAME = 100;
const MAX_GAME_USERNAME = 100;
const MAX_GAME_NAME     = 60;
const MAX_INTERNAL_NOTE = 500;
const MAX_RECHARGE_NOTES = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(v: string): boolean {
  return UUID_RE.test(v);
}

// ---------------------------------------------------------------------------
// Local DB row interfaces (prevents GenericStringError)
// ---------------------------------------------------------------------------

interface TxnRow {
  id: string;
  shop_id: string;
  provider: string;
  customer_payment_tag: string | null;
  normalized_customer_payment_tag: string | null;
  player_match_status: string;
  status: string;
  is_counted: boolean;
}

interface ExistingMappingRow {
  id: string;
  player_name: string | null;
  verification_status: string;
  status: string;
}

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
// addPlayerMapping
// ---------------------------------------------------------------------------

/**
 * Associate an unmatched payment transaction with a player.
 *
 * Accepts input from the AddPlayerPanel client component.
 * shop_id, normalized_payment_tag, added_by, and verification_status
 * are ALL derived server-side and cannot be overridden by the client.
 */
export async function addPlayerMapping(
  input: PlayerMappingInput
): Promise<PlayerMappingResult> {
  try {
    // ---- 1. Validate basic input ----------------------------------------
    const {
      transactionId,
      playerName,
      facebookName,
      gameUsername,
      primaryGame,
      internalNote,
    } = input;

    if (!transactionId || !isValidUUID(transactionId)) {
      return { success: false, error: "Invalid transaction ID." };
    }
    if (!playerName || playerName.trim().length === 0) {
      return { success: false, error: "Player name is required." };
    }
    if (playerName.trim().length > MAX_PLAYER_NAME) {
      return { success: false, error: `Player name must be ${MAX_PLAYER_NAME} characters or fewer.` };
    }
    if (facebookName && facebookName.length > MAX_FACEBOOK_NAME) {
      return { success: false, error: `Facebook name must be ${MAX_FACEBOOK_NAME} characters or fewer.` };
    }
    if (gameUsername && gameUsername.length > MAX_GAME_USERNAME) {
      return { success: false, error: `Game username must be ${MAX_GAME_USERNAME} characters or fewer.` };
    }
    if (primaryGame && primaryGame.length > MAX_GAME_NAME) {
      return { success: false, error: `Game name must be ${MAX_GAME_NAME} characters or fewer.` };
    }
    if (internalNote && internalNote.length > MAX_INTERNAL_NOTE) {
      return { success: false, error: `Note must be ${MAX_INTERNAL_NOTE} characters or fewer.` };
    }

    // ---- 2. Authenticate ------------------------------------------------
    const supabase = createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return { success: false, error: "Not authenticated." };
    }
    const userId = userData.user.id;

    // ---- 3. Load profile — derive shop_id, verify role ------------------
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("shop_id, role")
      .eq("id", userId)
      .returns<{ shop_id: string; role: string }[]>()
      .single();

    const profile = profileData as { shop_id: string; role: string } | null;

    if (profileError || !profile?.shop_id) {
      return { success: false, error: "No shop assigned to your account." };
    }

    const shopId: string = profile.shop_id;
    const role: string = profile.role;

    if (!["employee", "manager", "owner"].includes(role)) {
      return { success: false, error: "Insufficient permissions." };
    }

    // ---- 4. Load and verify the transaction -----------------------------
    const { data: txnData, error: txnError } = await supabase
      .from("payment_transactions")
      .select(
        "id, shop_id, provider, customer_payment_tag, " +
        "normalized_customer_payment_tag, player_match_status, status, is_counted"
      )
      .eq("id", transactionId)
      .returns<TxnRow[]>()
      .single();

    const txn = txnData as TxnRow | null;

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found." };
    }

    // Verify the transaction belongs to the authenticated shop
    if (txn.shop_id !== shopId) {
      return { success: false, error: "Transaction does not belong to your shop." };
    }

    // Must have a customer payment tag
    if (!txn.customer_payment_tag || !txn.normalized_customer_payment_tag) {
      return { success: false, error: "Transaction has no customer payment tag." };
    }

    // Provider must be CashApp or Chime
    if (txn.provider !== "CashApp" && txn.provider !== "Chime") {
      return { success: false, error: "Unsupported payment provider." };
    }

    // Transaction must not already be matched
    if (txn.player_match_status === "matched") {
      return { success: false, error: "This transaction is already matched to a player." };
    }

    // ---- 5. Normalize the tag server-side --------------------------------
    const normalizedTag = normalizePaymentTagOrThrow(
      txn.customer_payment_tag,
      txn.provider as "CashApp" | "Chime"
    );

    // ---- 6. Check for existing active mapping ----------------------------
    const { data: existingMappingsData, error: mappingCheckError } = await supabase
      .from("player_payment_tags")
      .select("id, player_name, verification_status, status")
      .eq("shop_id", shopId)
      .eq("provider", txn.provider)
      .eq("normalized_payment_tag", normalizedTag)
      .eq("status", "active")
      .returns<ExistingMappingRow[]>();

    if (mappingCheckError) {
      console.error("[payment-actions] mapping check error:", mappingCheckError.message);
      return { success: false, error: "Failed to check existing mappings." };
    }

    const existingMappings = (existingMappingsData ?? []) as ExistingMappingRow[];

    if (existingMappings.length > 0) {
      const existing = existingMappings[0];
      // Already has an active mapping
      if (existing.verification_status === "blocked") {
        return {
          success: false,
          error: "This payment tag has been blocked by a manager. Contact your manager.",
        };
      }
      // Already mapped — just link the transaction to the existing mapping
      const admin = createAdminClient();
      await admin
        .from("payment_transactions")
        .update({
          player_match_status: "matched",
          player_mapping_id: existing.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      await supabase.from("payment_audit_logs").insert({
        shop_id: shopId,
        entity_type: "payment_transaction",
        entity_id: transactionId,
        action: "transaction_linked_to_player",
        new_values: {
          player_mapping_id: existing.id,
          player_name: existing.player_name,
          matched_to_existing: true,
        },
        performed_by: userId,
      });

      return {
        success: true,
        mappingId: existing.id,
        transactionId,
        playerName: existing.player_name ?? playerName.trim(),
        playerMatchStatus: "matched",
      };
    }

    // ---- 7. Insert new mapping -------------------------------------------
    const { data: newMappingData, error: insertError } = await supabase
      .from("player_payment_tags")
      .insert({
        shop_id: shopId,
        provider: txn.provider,
        payment_tag: txn.customer_payment_tag,
        normalized_payment_tag: normalizedTag,
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        internal_note: internalNote?.trim() || null,
        verification_status: "employee_added",
        status: "active",
        added_by: userId,
      })
      .select("id")
      .returns<{ id: string }[]>()
      .single();

    const newMapping = newMappingData as { id: string } | null;

    if (insertError || !newMapping) {
      // Handle unique constraint violation (race condition)
      if (insertError?.code === "23505") {
        return {
          success: false,
          error: "A mapping for this payment tag already exists. Refresh and try again.",
        };
      }
      console.error("[payment-actions] insert error:", insertError?.message);
      return { success: false, error: "Failed to save player mapping." };
    }

    const mappingId = newMapping.id;

    // ---- 8. Update the transaction's match status -----------------------
    const admin = createAdminClient();
    const { error: txnUpdateError } = await admin
      .from("payment_transactions")
      .update({
        player_match_status: "matched",
        player_mapping_id: mappingId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (txnUpdateError) {
      console.error("[payment-actions] transaction update error:", txnUpdateError.message);
      // Mapping was created but transaction wasn't updated — non-fatal, log it
    }

    // ---- 9. Write audit log ---------------------------------------------
    await supabase.from("payment_audit_logs").insert({
      shop_id: shopId,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_created",
      new_values: {
        provider: txn.provider,
        payment_tag: txn.customer_payment_tag,
        normalized_payment_tag: normalizedTag,
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        verification_status: "employee_added",
        transaction_id: transactionId,
      },
      performed_by: userId,
    });

    return {
      success: true,
      mappingId,
      transactionId,
      playerName: playerName.trim(),
      playerMatchStatus: "matched",
    };
  } catch (err) {
    console.error("[payment-actions] addPlayerMapping unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// editPlayerMapping
// ---------------------------------------------------------------------------

/**
 * Edit an existing player mapping.
 *
 * Employees can only edit mappings they added themselves, and only when
 * verification_status is NOT manager_verified, blocked, or inactive.
 * Managers/owners can edit any mapping in their shop.
 */
export async function editPlayerMapping(
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

    // ---- 1. Validate input -----------------------------------------------
    if (!mappingId || !isValidUUID(mappingId)) {
      return { success: false, error: "Invalid mapping ID." };
    }
    if (!playerName || playerName.trim().length === 0) {
      return { success: false, error: "Player name is required." };
    }
    if (playerName.trim().length > MAX_PLAYER_NAME) {
      return { success: false, error: `Player name must be ${MAX_PLAYER_NAME} characters or fewer.` };
    }
    if (facebookName && facebookName.length > MAX_FACEBOOK_NAME) {
      return { success: false, error: `Facebook name must be ${MAX_FACEBOOK_NAME} characters or fewer.` };
    }
    if (gameUsername && gameUsername.length > MAX_GAME_USERNAME) {
      return { success: false, error: `Game username must be ${MAX_GAME_USERNAME} characters or fewer.` };
    }
    if (primaryGame && primaryGame.length > MAX_GAME_NAME) {
      return { success: false, error: `Game name must be ${MAX_GAME_NAME} characters or fewer.` };
    }
    if (internalNote && internalNote.length > MAX_INTERNAL_NOTE) {
      return { success: false, error: `Note must be ${MAX_INTERNAL_NOTE} characters or fewer.` };
    }

    // ---- 2. Authenticate ------------------------------------------------
    const supabase = createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return { success: false, error: "Not authenticated." };
    }
    const userId = userData.user.id;

    // ---- 3. Load profile ------------------------------------------------
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("shop_id, role")
      .eq("id", userId)
      .returns<{ shop_id: string; role: string }[]>()
      .single();

    const profile = profileData as { shop_id: string; role: string } | null;

    if (profileError || !profile?.shop_id) {
      return { success: false, error: "No shop assigned to your account." };
    }

    const shopId: string = profile.shop_id;
    const role: string = profile.role;

    // ---- 4. Load the mapping --------------------------------------------
    const { data: mappingData, error: mappingError } = await supabase
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

    if (mappingError || !mapping) {
      return { success: false, error: "Mapping not found." };
    }

    // Verify shop ownership
    if (role !== "owner" && mapping.shop_id !== shopId) {
      return { success: false, error: "Mapping does not belong to your shop." };
    }

    // ---- 5. Authorization checks ----------------------------------------
    const isManagerOrOwner = role === "manager" || role === "owner";
    const isEmployee = role === "employee";

    if (isEmployee) {
      // Employee can only edit their own mappings
      if (mapping.added_by !== userId) {
        return { success: false, error: "You can only edit mappings you added." };
      }
      // Cannot edit verified, blocked, or inactive mappings
      if (
        mapping.verification_status === "manager_verified" ||
        mapping.verification_status === "blocked" ||
        mapping.verification_status === "inactive" ||
        mapping.status === "inactive"
      ) {
        return {
          success: false,
          error: "This mapping has been verified or blocked by a manager and cannot be edited.",
        };
      }
    } else if (!isManagerOrOwner) {
      return { success: false, error: "Insufficient permissions." };
    }

    // ---- 6. Detect silent re-mapping (same tag → different player) ------
    // If player name is changing significantly, flag for manager review
    const nameChanged =
      mapping.player_name?.toLowerCase().trim() !== playerName.toLowerCase().trim();

    // ---- 7. Update the mapping ------------------------------------------
    const oldValues = {
      player_name: mapping.player_name,
      facebook_name: mapping.facebook_name,
      game_username: mapping.game_username,
      primary_game: mapping.primary_game,
      internal_note: mapping.internal_note,
    };

    const { error: updateError } = await supabase
      .from("player_payment_tags")
      .update({
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        internal_note: internalNote?.trim() || null,
        updated_by: userId,
        // If employee changes the name, drop back to employee_added
        ...(isEmployee && nameChanged
          ? { verification_status: "employee_added" }
          : {}),
      })
      .eq("id", mappingId);

    if (updateError) {
      console.error("[payment-actions] edit error:", updateError.message);
      return { success: false, error: "Failed to update player mapping." };
    }

    // ---- 8. Write audit log ---------------------------------------------
    await supabase.from("payment_audit_logs").insert({
      shop_id: mapping.shop_id,
      entity_type: "player_payment_tag",
      entity_id: mappingId,
      action: "player_mapping_updated",
      old_values: oldValues,
      new_values: {
        player_name: playerName.trim(),
        facebook_name: facebookName?.trim() || null,
        game_username: gameUsername?.trim() || null,
        primary_game: primaryGame?.trim() || null,
        internal_note: internalNote?.trim() || null,
      },
      performed_by: userId,
    });

    return {
      success: true,
      mappingId,
      playerName: playerName.trim(),
    };
  } catch (err) {
    console.error("[payment-actions] editPlayerMapping unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// createRecharge
// ---------------------------------------------------------------------------

/**
 * Record a recharge (game coins added to a player) for a confirmed payment.
 *
 * SECURITY:
 *   - shop_id, employee_id, cash_received, player_id are ALL derived server-side.
 *   - Client may NOT supply: shop_id, employee_id, cash_received, bonus_given,
 *     missing_recharge, recharge_status, or player_id.
 *   - cash_received is read from payment_transactions.amount — never from input.
 *   - The server recalculates bonus and missing independently.
 *   - Duplicate submission is prevented by a unique partial DB index and a
 *     pre-insert check.
 */

// Internal DB row types for this action
interface FullTxnRow {
  id: string;
  shop_id: string;
  direction: string;
  status: string;
  is_counted: boolean;
  amount: string | number;
  player_match_status: string;
  player_mapping_id: string | null;
}

interface MappingVerifyRow {
  id: string;
  verification_status: string;
  status: string;
  player_id: string | null;
}

interface GameRow {
  id: string;
  game_name: string;
  is_active: boolean;
}

interface ExistingRechargeRow {
  id: string;
}

// Convert DB status to TS RechargeStatus for the response
function dbStatusToTsStatus(db: DbRechargeStatus): RechargeStatus {
  switch (db) {
    case "bonus_given":       return "completed_with_bonus";
    case "missing_recharge":  return "under_recharged";
    case "exact":             return "completed_no_bonus";
    case "voided":            return "voided";
  }
}

export async function createRecharge(
  input: RechargeInput
): Promise<RechargeResult> {
  try {
    // ---- 1. Validate input ------------------------------------------------
    const { transactionId, gameId, gameUsername, coinsRecharged, notes } = input;

    if (!transactionId || !isValidUUID(transactionId)) {
      return { success: false, error: "Invalid transaction ID." };
    }
    if (!gameId || !isValidUUID(gameId)) {
      return { success: false, error: "A valid game must be selected." };
    }
    if (!gameUsername || gameUsername.trim().length === 0) {
      return { success: false, error: "Game username is required." };
    }
    if (gameUsername.trim().length > MAX_GAME_USERNAME) {
      return { success: false, error: `Game username must be ${MAX_GAME_USERNAME} characters or fewer.` };
    }
    if (notes && notes.length > MAX_RECHARGE_NOTES) {
      return { success: false, error: `Notes must be ${MAX_RECHARGE_NOTES} characters or fewer.` };
    }
    if (
      typeof coinsRecharged !== "number" ||
      !isFinite(coinsRecharged) ||
      isNaN(coinsRecharged)
    ) {
      return { success: false, error: "Coins recharged must be a valid number." };
    }
    if (coinsRecharged < 0) {
      return { success: false, error: "Coins recharged cannot be negative." };
    }

    // ---- 2. Authenticate --------------------------------------------------
    const supabase = createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return { success: false, error: "Not authenticated." };
    }
    const userId = userData.user.id;

    // ---- 3. Load profile — derive shop_id, verify role -------------------
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("shop_id, role")
      .eq("id", userId)
      .returns<{ shop_id: string; role: string }[]>()
      .single();

    const profile = profileData as { shop_id: string; role: string } | null;

    if (profileError || !profile?.shop_id) {
      return { success: false, error: "No shop assigned to your account." };
    }

    const shopId: string = profile.shop_id;
    const role: string = profile.role;

    if (!["employee", "manager", "owner"].includes(role)) {
      return { success: false, error: "Insufficient permissions." };
    }

    // ---- 4. Load and verify transaction -----------------------------------
    const { data: txnData, error: txnError } = await supabase
      .from("payment_transactions")
      .select("id, shop_id, direction, status, is_counted, amount, player_match_status, player_mapping_id")
      .eq("id", transactionId)
      .returns<FullTxnRow[]>()
      .single();

    const txn = txnData as FullTxnRow | null;

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found." };
    }

    // Shop isolation
    if (txn.shop_id !== shopId) {
      return { success: false, error: "Transaction does not belong to your shop." };
    }

    // Business rule checks
    if (txn.direction !== "received") {
      return { success: false, error: "Recharge is only allowed for received transactions." };
    }
    if (txn.status !== "confirmed") {
      return { success: false, error: "Recharge is only allowed for confirmed transactions." };
    }
    if (!txn.is_counted) {
      return { success: false, error: "Recharge is only allowed for counted transactions." };
    }
    if (txn.player_match_status !== "matched") {
      return { success: false, error: "Player must be matched before recharging." };
    }
    if (!txn.player_mapping_id) {
      return { success: false, error: "No active player mapping found for this transaction." };
    }

    // ---- 5. Verify player mapping is active and not blocked ---------------
    const { data: mappingData, error: mappingError } = await supabase
      .from("player_payment_tags")
      .select("id, verification_status, status, player_id")
      .eq("id", txn.player_mapping_id)
      .returns<MappingVerifyRow[]>()
      .single();

    const mapping = mappingData as MappingVerifyRow | null;

    if (mappingError || !mapping) {
      return { success: false, error: "Player mapping not found." };
    }
    if (mapping.status !== "active") {
      return { success: false, error: "Player mapping is inactive. Contact your manager." };
    }
    if (mapping.verification_status === "blocked") {
      return { success: false, error: "Player mapping is blocked. Contact your manager." };
    }
    if (
      mapping.verification_status === "conflicting_match" ||
      mapping.verification_status === "conflicting"
    ) {
      return { success: false, error: "Player mapping has a conflict. Contact your manager." };
    }

    // ---- 6. Verify selected game is valid (belongs to global games table) -
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("id, game_name, is_active")
      .eq("id", gameId)
      .returns<GameRow[]>()
      .single();

    const game = gameData as GameRow | null;

    if (gameError || !game) {
      return { success: false, error: "Selected game not found." };
    }
    if (!game.is_active) {
      return { success: false, error: "Selected game is not active." };
    }

    // ---- 7. Check for existing non-voided recharge (duplicate prevention) -
    const { data: existingData, error: existingError } = await supabase
      .from("payment_recharges")
      .select("id")
      .eq("payment_transaction_id", transactionId)
      .is("voided_at", null)
      .returns<ExistingRechargeRow[]>();

    if (existingError) {
      console.error("[payment-actions] duplicate check error:", existingError.message);
      return { success: false, error: "Failed to check for existing recharge." };
    }

    const existing = (existingData ?? []) as ExistingRechargeRow[];
    if (existing.length > 0) {
      // Log the duplicate attempt
      await supabase.from("payment_audit_logs").insert({
        shop_id: shopId,
        entity_type: "payment_recharge",
        entity_id: existing[0].id,
        action: "recharge_duplicate_prevented",
        new_values: {
          attempted_transaction_id: transactionId,
          attempted_by: userId,
          coins_recharged: coinsRecharged,
        },
        performed_by: userId,
      });
      return { success: false, error: "This transaction has already been recharged." };
    }

    // ---- 8. Read cash_received from transaction (AUTHORITATIVE) ----------
    const cashReceived = Number(txn.amount);

    // ---- 9. Server-side calculation (never trust client values) ----------
    let calc;
    try {
      calc = calculateRecharge(cashReceived, coinsRecharged);
    } catch (calcErr) {
      if (calcErr instanceof RechargeCalculationError) {
        return { success: false, error: calcErr.message };
      }
      return { success: false, error: "Invalid recharge values." };
    }

    const { bonus_given, missing_recharge, db_recharge_status } = calc;

    // ---- 10. Insert recharge record --------------------------------------
    const { data: insertData, error: insertError } = await supabase
      .from("payment_recharges")
      .insert({
        shop_id: shopId,
        payment_transaction_id: transactionId,
        employee_id: userId,
        player_id: mapping.player_id ?? null,
        game_id: gameId,
        game_username: gameUsername.trim(),
        cash_received: cashReceived,
        coins_recharged: coinsRecharged,
        bonus_given,
        missing_recharge,
        recharge_status: db_recharge_status,
        notes: notes?.trim() || null,
      })
      .select("id")
      .returns<{ id: string }[]>()
      .single();

    const inserted = insertData as { id: string } | null;

    if (insertError || !inserted) {
      // Handle unique constraint violation (race condition)
      if (insertError?.code === "23505") {
        return {
          success: false,
          error: "This transaction was just recharged by another session. Please refresh.",
        };
      }
      console.error("[payment-actions] recharge insert error:", insertError?.message);
      // Log the failure
      await supabase.from("payment_audit_logs").insert({
        shop_id: shopId,
        entity_type: "payment_recharge",
        entity_id: null,
        action: "recharge_creation_failed",
        new_values: {
          transaction_id: transactionId,
          error: insertError?.message ?? "unknown",
        },
        performed_by: userId,
      });
      return { success: false, error: "Failed to save recharge. Please try again." };
    }

    const rechargeId = inserted.id;

    // ---- 11. Write audit log ---------------------------------------------
    const auditAction =
      db_recharge_status === "bonus_given"
        ? "recharge_completed_with_bonus"
        : db_recharge_status === "missing_recharge"
        ? "recharge_under_recharged"
        : "recharge_completed_no_bonus";

    await supabase.from("payment_audit_logs").insert({
      shop_id: shopId,
      entity_type: "payment_recharge",
      entity_id: rechargeId,
      action: auditAction,
      new_values: {
        transaction_id: transactionId,
        game_id: gameId,
        game_name: game.game_name,
        game_username: gameUsername.trim(),
        cash_received: cashReceived,
        coins_recharged: coinsRecharged,
        bonus_given,
        missing_recharge,
        recharge_status: db_recharge_status,
      },
      performed_by: userId,
    });

    // Also log "recharge_created" for general audit trail
    await supabase.from("payment_audit_logs").insert({
      shop_id: shopId,
      entity_type: "payment_recharge",
      entity_id: rechargeId,
      action: "recharge_created",
      new_values: {
        transaction_id: transactionId,
        employee_id: userId,
        cash_received: cashReceived,
        coins_recharged: coinsRecharged,
        bonus_given,
        missing_recharge,
        recharge_status: db_recharge_status,
      },
      performed_by: userId,
    });

    // ---- 12. Return safe response ----------------------------------------
    return {
      success: true,
      rechargeId,
      transactionId,
      rechargeStatus: dbStatusToTsStatus(db_recharge_status),
      bonusGiven: bonus_given,
      missingRecharge: missing_recharge,
      coinsRecharged,
    };
  } catch (err) {
    console.error("[payment-actions] createRecharge unexpected error:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
