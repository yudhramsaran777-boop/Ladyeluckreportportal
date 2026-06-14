import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  { name: "name", label: "Shop Name", type: "text", required: true, fullWidth: true },
  { name: "status", label: "Status", type: "toggle-status" },
  { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
];

const columns: ColumnConfig[] = [
  { key: "name", label: "Shop Name" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];

export default async function OwnerShopsPage() {
  const supabase = createClient();
  const { data: shops } = await supabase
    .from("shops")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Shops" showDateFilter={false} />
      <CrudPageClient
        table="shops"
        columns={columns}
        fields={fields}
        rows={shops || []}
        emptyMessage="No shops yet"
        emptyHint="Create your first shop to get started."
        addLabel="Add Shop"
      />
    </div>
  );
}
