// ============================================================================
// Lady E Luck Portal — PlayerMappingReviewSection (Server Component)
// Phase 4: Fetches all player_payment_tags for the manager's shop server-side,
// passes them to the PlayerMappingReview client component.
//
// Placed below the payment-accounts CRUD on /manager/payment-accounts,
// behind the payment_dashboard_enabled feature flag.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { PlayerMappingReview } from "./player-mapping-review";
import type { ManagerPlayerMappingRow } from "@/lib/payment/payment-types";

interface PlayerMappingReviewSectionProps {
  shopId: string;
}

// ---------------------------------------------------------------------------
// Local DB row interfaces (prevents GenericStringError)
// ---------------------------------------------------------------------------

interface TagRow {
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
  manager_review_reason: string | null;
  verification_status: string;
  status: string;
  added_by: string | null;
  verified_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

export async function PlayerMappingReviewSection({
  shopId,
}: PlayerMappingReviewSectionProps) {
  const supabase = createClient();

  // Fetch mappings + added_by name via join
  const { data: tagData, error } = await supabase
    .from("player_payment_tags")
    .select(
      "id, shop_id, provider, payment_tag, normalized_payment_tag, " +
      "player_name, facebook_name, game_username, primary_game, internal_note, " +
      "manager_review_reason, verification_status, status, " +
      "added_by, verified_by, reviewed_at, created_at, updated_at"
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<TagRow[]>();

  if (error) {
    console.error("[player-mapping-review-section] fetch error:", error.message);
    return (
      <div className="card-panel p-4">
        <p className="text-xs text-danger">Failed to load player mappings.</p>
      </div>
    );
  }

  const rows = (tagData ?? []) as TagRow[];

  // Resolve added_by names (batch lookup)
  const userIds = [...new Set(rows.map((r) => r.added_by).filter(Boolean) as string[])];
  const profileMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
      .returns<ProfileRow[]>();

    for (const p of (profileData ?? []) as ProfileRow[]) {
      if (p.id && p.full_name) profileMap.set(p.id, p.full_name);
    }
  }

  const mappings: ManagerPlayerMappingRow[] = rows.map((r) => ({
    id: r.id,
    shop_id: r.shop_id,
    provider: r.provider as ManagerPlayerMappingRow["provider"],
    payment_tag: r.payment_tag,
    normalized_payment_tag: r.normalized_payment_tag,
    player_name: r.player_name,
    facebook_name: r.facebook_name,
    game_username: r.game_username,
    primary_game: r.primary_game,
    internal_note: r.internal_note,
    manager_review_reason: r.manager_review_reason ?? null,
    verification_status: r.verification_status as ManagerPlayerMappingRow["verification_status"],
    status: r.status as "active" | "inactive",
    added_by: r.added_by,
    added_by_name: r.added_by ? (profileMap.get(r.added_by) ?? null) : null,
    verified_by: r.verified_by,
    verified_by_name: null, // not fetched to keep query simple
    reviewed_at: r.reviewed_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return (
    <div className="card-panel overflow-hidden">
      <div className="border-b border-panelborder px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Player Mappings</h2>
        <p className="mt-0.5 text-xs text-emerald-200/40">
          Review, verify, or block payment tag → player associations added by employees.
        </p>
      </div>
      <PlayerMappingReview initialMappings={mappings} />
    </div>
  );
}
