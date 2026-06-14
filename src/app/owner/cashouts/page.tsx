import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending", value: "pending" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
      { label: "Completed", value: "completed" },
    ],
    required: true,
  },
];

export default async function OwnerCashoutsPage() {
  const supabase = createClient();
  const { data: cashouts } = await supabase
    .from("shift_cashouts")
    .select("*, shops(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const columns: ColumnConfig[] = [
    { key: "customer_facebook_name", label: "Player Name" },
    { key: "game_name", label: "Game", render: "gameBadge" },
    { key: "amount", label: "Amount", render: "currency" },
    { key: "payment_method", label: "Method" },
    { key: "payment_tag", label: "Cash Tag" },
    { key: "shops", label: "Shop", render: "relation", relationKey: "shops.name" },
    { key: "status", label: "Status", render: "statusBadge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Cashouts" />
      <CrudPageClient
        table="shift_cashouts"
        columns={columns}
        fields={fields}
        rows={cashouts || []}
        emptyMessage="No cashouts yet"
        emptyHint="Redeem entries submitted by employees will appear here."
        canAdd={false}
        canDelete={false}
        addLabel="Update Status"
      />
    </div>
  );
}
