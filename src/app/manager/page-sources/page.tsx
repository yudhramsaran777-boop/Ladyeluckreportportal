import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  { name: "page_name", label: "Page Name", type: "text", required: true },
  {
    name: "platform",
    label: "Platform",
    type: "select",
    options: [
      { label: "Facebook", value: "Facebook" },
      { label: "Instagram", value: "Instagram" },
    ],
    defaultValue: "Facebook",
  },
  { name: "page_url", label: "Page URL", type: "text" },
  { name: "status", label: "Status", type: "toggle-status" },
  { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
];

const columns: ColumnConfig[] = [
  { key: "page_name", label: "Page Name" },
  { key: "platform", label: "Platform" },
  { key: "status", label: "Status", render: "statusBadge" },
];

export default async function ManagerPageSourcesPage() {
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
        <PageHeader title="Page Sources" showDateFilter={false} />
        <EmptyState message="No shop assigned" hint="Ask the owner to assign you to a shop." />
      </div>
    );
  }

  const { data: sources } = await supabase
    .from("page_sources")
    .select("*")
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Page Sources" showDateFilter={false} />
      <CrudPageClient
        table="page_sources"
        columns={columns}
        fields={fields}
        rows={sources || []}
        emptyMessage="No page sources yet"
        emptyHint="Add Facebook or Instagram page sources for your shop."
        addLabel="Add Page Source"
        fixedValues={{ shop_id: profile.shop_id }}
          />
    </div>
  );
}
