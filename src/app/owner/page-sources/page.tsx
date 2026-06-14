import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

export default async function OwnerPageSourcesPage() {
  const supabase = createClient();
  const [{ data: sources }, { data: shops }] = await Promise.all([
    supabase
      .from("page_sources")
      .select("*, shops(name)")
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  const shopOptions = (shops || []).map((s) => ({ label: s.name, value: s.id }));

  const fields: FieldConfig[] = [
    { name: "shop_id", label: "Shop", type: "select", options: shopOptions, required: true },
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
    { key: "shops", label: "Shop", render: "relation", relationKey: "shops.name" },
    { key: "page_name", label: "Page Name" },
    { key: "platform", label: "Platform" },
    { key: "status", label: "Status", render: "statusBadge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Page Sources" showDateFilter={false} />
      <CrudPageClient
        table="page_sources"
        columns={columns}
        fields={fields}
        rows={sources || []}
        emptyMessage="No page sources yet"
        emptyHint="Add Facebook or Instagram page sources for a shop."
        addLabel="Add Page Source"
      />
    </div>
  );
}
