import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export default async function EmployeeMyReportsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from("shift_reports")
    .select("*")
    .eq("employee_id", userData.user!.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const reportIds = (reports || []).map((r) => r.id);

  const [{ data: entries }, { data: cashouts }] = await Promise.all([
    reportIds.length
      ? supabase
          .from("shift_game_entries")
          .select("shift_report_id, real_recharge")
          .in("shift_report_id", reportIds)
      : Promise.resolve({ data: [] }),
    reportIds.length
      ? supabase
          .from("shift_cashouts")
          .select("shift_report_id, amount")
          .in("shift_report_id", reportIds)
      : Promise.resolve({ data: [] }),
  ]);

  const totalsByReport = new Map<string, { recharge: number }>();
  for (const e of entries || []) {
    const cur = totalsByReport.get(e.shift_report_id) || { recharge: 0 };
    cur.recharge += Number(e.real_recharge || 0);
    totalsByReport.set(e.shift_report_id, cur);
  }

  const cashoutByReport = new Map<string, number>();
  for (const c of cashouts || []) {
    cashoutByReport.set(
      c.shift_report_id,
      (cashoutByReport.get(c.shift_report_id) || 0) + Number(c.amount || 0)
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Reports" showDateFilter={false} />
      <div className="card-panel p-4">
        {(reports || []).length === 0 ? (
          <EmptyState
            message="You haven't submitted any shift reports yet"
            hint="Go to Submit Shift to start your first shift report."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-emerald-200/50">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Shift</th>
                  <th className="py-2 pr-4">Real Recharge</th>
                  <th className="py-2 pr-4">Cashout</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {(reports || []).map((r) => {
                  const totals = totalsByReport.get(r.id) || { recharge: 0 };
                  const cashout = cashoutByReport.get(r.id) || 0;
                  const canEdit =
                    r.status === "draft" ||
                    r.status === "submitted" ||
                    r.status === "needs_correction";
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 text-emerald-100">{r.shift_date}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{r.shift_interval}</td>
                      <td className="py-2 pr-4 text-emerald-100">
                        {formatCurrency(totals.recharge)}
                      </td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(cashout)}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2 pr-4">
                        {canEdit ? (
                          <Link
                            href={`/employee/shift-report?reportId=${r.id}`}
                            className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20"
                          >
                            Edit
                          </Link>
                        ) : (
                          <span className="text-xs text-emerald-200/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
