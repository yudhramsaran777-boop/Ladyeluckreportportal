import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  formatCurrency,
  singleReportTotalsFromStoredEntries,
} from "@/lib/calculations";
import { fetchAllByIds } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";


export default async function ManagerShiftReportsPage() {
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
        <PageHeader title="Shift Reports" showDateFilter={false} />
        <EmptyState message="No shop assigned. Contact owner." />
      </div>
    );
  }

  const { data: reports } = await supabase
    .from("shift_reports")
    .select("*")
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const reportIds = (reports || []).map((r) => r.id);
  // fetchAllByIds: complete results past Supabase's 1,000-row cap
  // (100 reports × many games per report can exceed 1,000 entries).
  const [entries, cashouts] = await Promise.all([
    fetchAllByIds<any>(reportIds, (ids, from, to) =>
      supabase
        .from("shift_game_entries")
        .select("shift_report_id, game_name, real_recharge, normal_coin_difference, game_cost_percentage, game_cost, true_profit")
        .in("shift_report_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllByIds<any>(reportIds, (ids, from, to) =>
      supabase
        .from("shift_cashouts")
        .select("shift_report_id, amount")
        .eq("shop_id", profile.shop_id)
        .in("shift_report_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  // Group entries by report. Use stored game_cost from DB (what was calculated at
  // submission) so this list matches the owner dashboard exactly.
  const entriesByReport = new Map<string, any[]>();
  for (const entry of entries || []) {
    const list = entriesByReport.get(entry.shift_report_id) ?? [];
    list.push(entry);
    entriesByReport.set(entry.shift_report_id, list);
  }

  const totalsByReport = new Map<
    string,
    { recharge: number; normalDifference: number; gameCost: number; profit: number; cashout: number; cashoutCount: number; trueProfit: number }
  >();
  for (const [reportId, group] of entriesByReport) {
    // Canonical formula shared with all owner/manager views.
    const rt = singleReportTotalsFromStoredEntries(group);
    totalsByReport.set(reportId, {
      recharge: rt.totalRecharge,
      normalDifference: rt.totalProfit,
      gameCost: rt.totalGameCost,
      profit: rt.totalProfit,
      cashout: 0,
      cashoutCount: 0,
      trueProfit: rt.totalTrueProfit,
    });
  }
  for (const cashout of cashouts || []) {
    const current = totalsByReport.get(cashout.shift_report_id) ?? {
      recharge: 0,
      normalDifference: 0,
      gameCost: 0,
      profit: 0,
      cashout: 0,
      cashoutCount: 0,
      trueProfit: 0,
    };
    current.cashout += Number(cashout.amount || 0);
    current.cashoutCount += 1;
    totalsByReport.set(cashout.shift_report_id, current);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Shift Reports" showDateFilter={false} />
      <div className="card-panel p-4">
        {(reports || []).length === 0 ? (
          <EmptyState message="No shift reports yet" hint="Employees submit shift reports each shift." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-emerald-200/50">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Interval</th>
                  <th className="py-2 pr-4">Real Recharge</th>
                  <th className="py-2 pr-4">Normal Diff</th>
                  <th className="py-2 pr-4">Game Cost</th>
                  <th className="py-2 pr-4">Profit</th>
                  <th className="py-2 pr-4">Cashout</th>
                  <th className="py-2 pr-4">Cashouts Done</th>
                  <th className="py-2 pr-4">True Profit</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {(reports || []).map((report) => {
                  const totals = totalsByReport.get(report.id) || {
                    recharge: 0,
                    normalDifference: 0,
                    gameCost: 0,
                    profit: 0,
                    cashout: 0,
                    cashoutCount: 0,
                    trueProfit: 0,
                  };
                  return (
                    <tr key={report.id}>
                      <td className="py-2 pr-4 text-emerald-100">{report.employee_name || "-"}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{report.shift_date}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{report.shift_interval}</td>
                      <td className="py-2 pr-4 text-emerald-100">{formatCurrency(totals.recharge)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.normalDifference)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.gameCost)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.profit)}</td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(totals.cashout)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{totals.cashoutCount}</td>
                      <td className={totals.trueProfit >= 0 ? "py-2 pr-4 text-positive" : "py-2 pr-4 text-danger"}>
                        {formatCurrency(totals.trueProfit)}
                      </td>
                      <td className="py-2 pr-4"><StatusBadge status={report.status} /></td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/manager/shift-reports/${report.id}`}
                          className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20"
                        >
                          View/Edit
                        </Link>
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
