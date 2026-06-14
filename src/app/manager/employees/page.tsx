import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function ManagerEmployeesPage() {
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
        <PageHeader title="Employees" showDateFilter={false} />
        <EmptyState message="No shop assigned" hint="Ask the owner to assign you to a shop." />
      </div>
    );
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("shop_id", profile.shop_id)
    .eq("role", "employee")
    .order("full_name");

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" showDateFilter={false} />
      <div className="card-panel p-4">
        {(employees || []).length === 0 ? (
          <EmptyState
            message="No employees assigned to your shop yet"
            hint="Ask the owner to assign employees to this shop."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-emerald-200/50">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panelborder">
              {(employees || []).map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 text-emerald-100">{e.full_name || "—"}</td>
                  <td className="py-2 pr-4 text-emerald-100/70">{e.email}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={e.is_active ? "active" : "inactive"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
