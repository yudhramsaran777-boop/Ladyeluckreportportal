import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UserAssignmentTable } from "@/components/crud/user-assignment-table";
import { AddUserModal } from "@/components/crud/add-user-modal";
import { createManager } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerManagersPage() {
  const supabase = createClient();
  const [{ data: managers }, { data: shops }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, shop_id, is_active")
      .eq("role", "manager")
      .order("full_name"),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Managers" showDateFilter={false} />
      <p className="text-sm text-emerald-200/60">
        Use &quot;Add Manager&quot; to create a manager account directly. Assign
        them to a shop and activate their access here.
      </p>
      <AddUserModal roleLabel="Manager" shops={shops || []} action={createManager} />
      <UserAssignmentTable
        users={managers || []}
        shops={shops || []}
        emptyMessage="No managers found."
              />
    </div>
  );
}
