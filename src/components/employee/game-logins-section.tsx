import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { GameLoginCard } from "./game-login-card";

export async function GameLoginsSection({ shopId }: { shopId: string | null }) {
  if (!shopId) {
    return (
      <div className="card-panel p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">Game Logins</h2>
        <EmptyState message="No shop assigned to your account yet." />
      </div>
    );
  }

  const supabase = createClient();
  const { data: accounts, error } = await supabase
    .from("game_accounts")
    .select("*")
    .eq("shop_id", shopId)
    .ilike("status", "active")
    .order("game_name");

  return (
    <div className="card-panel p-4">
      <h2 className="mb-4 text-sm font-semibold text-white">Game Logins</h2>
      {error ? (
        <EmptyState
          message="Could not load game accounts."
          hint={error.message}
        />
      ) : (accounts || []).length === 0 ? (
        <EmptyState
          message="No active game accounts assigned."
          hint={`Shop ${shopId} returned 0 active game accounts.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts || []).map((a) => (
            <GameLoginCard key={a.id} account={a} />
          ))}
        </div>
      )}
    </div>
  );
}
