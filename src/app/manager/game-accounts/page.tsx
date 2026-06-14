import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import { GAMES } from "@/lib/constants";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const gameOptions = GAMES.map((g) => ({ label: `${g.name} (${g.code})`, value: g.code }));

const fields: FieldConfig[] = [
  { name: "game_code", label: "Game", type: "select", options: gameOptions, required: true },
  { name: "game_link", label: "Game Link", type: "text" },
  { name: "admin_link", label: "Admin Link", type: "text" },
  { name: "username", label: "Username", type: "text" },
  { name: "password", label: "Password", type: "password" },
  { name: "vendor", label: "Vendor", type: "text" },
  { name: "admin_name", label: "Admin Name", type: "text" },
  { name: "status", label: "Status", type: "toggle-status" },
  { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
];

const columns: ColumnConfig[] = [
  { key: "game_name", label: "Game", render: "gameBadge" },
  { key: "username", label: "Username" },
  { key: "password", label: "Password", render: "password" },
  { key: "vendor", label: "Vendor" },
  { key: "status", label: "Status", render: "statusBadge" },
];

export default async function ManagerGameAccountsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, shop_id")
    .eq("id", userData.user!.id)
    .single();

  if (!profile?.shop_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Game Accounts" showDateFilter={false} />
        <EmptyState
          message="Manager is not assigned to a shop. Owner must assign this manager to a shop first."
          hint="Ask the owner to assign you to a shop."
        />
      </div>
    );
  }

  const { data: accounts } = await supabase
    .from("game_accounts")
    .select("*")
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false });

  const { count: paymentAccountCount } = await supabase
    .from("payment_accounts")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", profile.shop_id);

  return (
    <div className="space-y-6">
      <PageHeader title="Game Accounts" showDateFilter={false} />

      <CrudPageClient
        table="game_accounts"
        columns={columns}
        fields={fields}
        rows={accounts || []}
        emptyMessage="No game accounts assigned to your shop yet."
        emptyHint="Ask the owner to add game accounts for your shop."
        addLabel="Add Game Account"
        fixedValues={{ shop_id: profile.shop_id }}
        transformType="gameAccount"
      />
    </div>
  );
}
