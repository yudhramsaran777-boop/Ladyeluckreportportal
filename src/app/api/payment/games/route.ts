// ============================================================================
// Lady E Luck Portal - GET /api/payment/games
// Phase 5: Returns active games for the recharge dialog dropdown.
//
// SECURITY:
//   - Requires authentication (401 if not logged in).
//   - Returns only the global games table rows where is_active = true.
//   - No shop-scoped data is returned here; games are a global reference table.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface GameRow {
  id: string;
  game_code: string;
  game_name: string;
  is_active: boolean;
}

export async function GET() {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("games")
    .select("id, game_code, game_name, is_active")
    .eq("is_active", true)
    .order("game_name", { ascending: true })
    .returns<GameRow[]>();

  if (error) {
    console.error("[api/payment/games] query error:", error.message);
    return NextResponse.json({ games: [] });
  }

  return NextResponse.json({ games: data ?? [] });
}
