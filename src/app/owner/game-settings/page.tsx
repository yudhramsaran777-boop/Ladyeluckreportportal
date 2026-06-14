import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  { name: "game_name", label: "Game", type: "text", required: true },
  { name: "cost_percentage", label: "Cost Percentage (%)", type: "number", required: true },
  { name: "is_active", label: "Status", type: "toggle-status" },
];

const columns: ColumnConfig[] = [
  { key: "game_name", label: "Game", render: "gameBadge" },
  { key: "game_code", label: "Code" },
  { key: "cost_percentage", label: "Cost %", render: "percent" },
  { key: "is_active", label: "Status", render: "activeBadge" },
];

export default async function OwnerGameSettingsPage() {
  const supabase = createClient();
  const { data: settings } = await supabase
    .from("game_settings")
    .select("*")
    .order("game_name");

  return (
    <div className="space-y-6">
      <PageHeader title="Game Settings" showDateFilter={false} />
      <p className="text-sm text-emerald-200/60">
        These cost percentages are used to calculate Game Cost and True Profit on
        every shift report. Only the Owner can edit these.
      </p>
      <CrudPageClient
        table="game_settings"
        columns={columns}
        fields={fields}
        rows={settings || []}
        emptyMessage="Game settings not seeded"
        emptyHint="Run the SQL migration to seed default game cost percentages."
        canAdd={false}
        canDelete={false}
        transformType="gameSettingsActive"
      />
    </div>
  );
}
