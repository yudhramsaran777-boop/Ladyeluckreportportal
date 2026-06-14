import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export default async function EmployeeCashoutsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: cashouts } = await supabase
    .from("shift_cashouts")
    .select("*")
    .eq("employee_id", userData.user!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader title="My Cashouts" showDateFilter={false} />
      <div className="card-panel p-4">
        {(cashouts || []).length === 0 ? (
          <EmptyState
            message="You haven't added any redeem/cashout entries yet"
            hint="Add redeem entries from the Submit Shift page during your shift."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-emerald-200/50">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Tag / Info</th>
                  <th className="py-2 pr-4">Page Source</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {(cashouts || []).map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 text-emerald-100/70">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 text-emerald-100">
                      {c.customer_facebook_name || "—"}
                    </td>
                    <td className="py-2 pr-4 text-emerald-100/70">{c.game_name}</td>
                    <td className="py-2 pr-4 text-positive">{formatCurrency(Number(c.amount))}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{c.payment_method}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{c.payment_tag || "—"}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">
                      {c.page_source_name || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
