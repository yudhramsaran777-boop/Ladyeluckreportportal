import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import { GAMES } from "@/lib/constants";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

export default async function OwnerGameAccountsPage() {
  const supabase = createClient();
  const [{ data: accounts }, { data: shops }] = await Promise.all([
    supabase
      .from("game_accounts")
      .select("*, shops(name)")
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  const shopOptions = (shops || []).map((s) => ({ label: s.name, value: s.id }));
  const gameOptions = GAMES.map((g) => ({ label: `${g.name} (${g.code})`, value: g.code }));

  const fields: FieldConfig[] = [
    { name: "shop_id", label: "Shop", type: "select", options: shopOptions, required: true },
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
    { key: "shops", label: "Shop", render: "relation", relationKey: "shops.name" },
    { key: "game_name", label: "Game", render: "gameBadge" },
    { key: "username", label: "Username" },
    { key: "password", label: "Password", render: "password" },
    { key: "vendor", label: "Vendor" },
    { key: "status", label: "Status", render: "statusBadge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Game Accounts" showDateFilter={false} />
      <CrudPageClient
        table="game_accounts"
        columns={columns}
        fields={fields}
        rows={accounts || []}
        emptyMessage="No game accounts assigned"
        emptyHint="Add game usernames and passwords for a shop."
        addLabel="Add Game Account"
        transformType="gameAccount"
      />
    </div>
  );
}
