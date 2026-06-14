import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UserAssignmentTable } from "@/components/crud/user-assignment-table";
import { AddUserModal } from "@/components/crud/add-user-modal";
import { createEmployee } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerEmployeesPage() {
  const supabase = createClient();
  const [{ data: employees }, { data: shops }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, shop_id, is_active")
      .eq("role", "employee")
      .order("full_name"),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" showDateFilter={false} />
      <p className="text-sm text-emerald-200/60">
        Use &quot;Add Employee&quot; to create an employee account directly. Assign
        them to a shop and activate their access here.
      </p>
      <AddUserModal roleLabel="Employee" shops={shops || []} action={createEmployee} />
      <UserAssignmentTable
        users={employees || []}
        shops={shops || []}
        emptyMessage="No employees found."
             />
    </div>
  );
}
