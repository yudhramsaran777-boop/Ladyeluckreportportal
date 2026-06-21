// ============================================================================
// Lady E Luck Portal — Player Matching Helper
// Phase 4: Server-only. Looks up an active player_payment_tags mapping for a
// given transaction's shop, provider, and normalized payment tag.
//
// Returns:
//   matched      — exactly one active mapping found
//   no_match     — no mapping exists for this tag
//   conflicting  — more than one active mapping exists (data integrity issue)
//   blocked      — a single mapping exists but is blocked
//
// NEVER matches across shops.
// NEVER matches CashApp mapping to a Chime transaction.
// NEVER guesses when result is ambiguous.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { normalizePaymentTag, type NormalizableProvider } from "./player-tag-normalizer";

export type MatchOutcome = "matched" | "no_match" | "conflicting" | "blocked";

export interface PlayerMatchResult {
  outcome: MatchOutcome;
  /** The winning mapping row, present when outcome is "matched" or "blocked". */
  mapping?: {
    id: string;
    player_name: string | null;
    facebook_name: string | null;
    game_username: string | null;
    primary_game: string | null;
    verification_status: string;
    status: string;
  };
  /** The normalized tag that was looked up. */
  normalizedTag: string;
}

// ---------------------------------------------------------------------------
// Local DB row interface
// ---------------------------------------------------------------------------

interface MappingHit {
  id: string;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  verification_status: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Look up the active player mapping for a transaction's payment tag.
 *
 * @param shopId       — derived server-side, never from client input
 * @param provider     — "CashApp" | "Chime"
 * @param rawPaymentTag — the customer_payment_tag from the transaction
 */
export async function matchPlayerForTag(
  shopId: string,
  provider: NormalizableProvider,
  rawPaymentTag: string
): Promise<PlayerMatchResult> {
  const norm = normalizePaymentTag(rawPaymentTag, provider);
  if (!norm.valid) {
    return { outcome: "no_match", normalizedTag: "" };
  }
  const normalizedTag = norm.normalized;

  const supabase = createClient();

  const { data: rows, error } = await supabase
    .from("player_payment_tags")
    .select(
      "id, player_name, facebook_name, game_username, primary_game, " +
      "verification_status, status"
    )
    .eq("shop_id", shopId)
    .eq("provider", provider)
    .eq("normalized_payment_tag", normalizedTag)
    .eq("status", "active")
    .returns<MappingHit[]>();

  if (error) {
    console.error("[player-matching] lookup error:", error.message);
    return { outcome: "no_match", normalizedTag };
  }

  const matches = rows ?? [];

  if (matches.length === 0) {
    return { outcome: "no_match", normalizedTag };
  }

  if (matches.length > 1) {
    // More than one active mapping for same shop/provider/tag — data issue
    return { outcome: "conflicting", normalizedTag };
  }

  const mapping = matches[0];

  if (mapping.status === "active" && mapping.verification_status === "blocked") {
    return { outcome: "blocked", mapping, normalizedTag };
  }

  return { outcome: "matched", mapping, normalizedTag };
}
