import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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

const columns: ColumnConfig[] = [
  { key: "customer_facebook_name", label: "Player Name" },
  { key: "game_name", label: "Game", render: "gameBadge" },
  { key: "amount", label: "Amount", render: "currency" },
  { key: "payment_method", label: "Method" },
  { key: "payment_tag", label: "Cash Tag" },
  { key: "status", label: "Status", render: "statusBadge" },
];

export default async function ManagerCashoutsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userData.user!.id)
    .single();

  if (!profile?.shop_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cashouts" />
        <EmptyState message="No shop assigned" hint="Ask the owner to assign you to a shop." />
      </div>
    );
  }

  const { data: cashouts } = await supabase
    .from("shift_cashouts")
    .select("*")
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false })
    .limit(200);

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
