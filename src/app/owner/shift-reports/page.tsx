import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import {
  formatCurrency,
  singleReportTotalsFromStoredEntries,
} from "@/lib/calculations";
import { fetchAllByIds } from "@/lib/supabase/fetch-all";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Submitted", value: "submitted" },
      { label: "Needs Correction", value: "needs_correction" },
      { label: "Approved", value: "approved" },
      { label: "Locked", value: "locked" },
    ],
    required: true,
  },
];

export default async function OwnerShiftReportsPage() {
  const supabase = createClient();

  const [{ data: reports }, { data: shops }] = await Promise.all([
    supabase
      .from("shift_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("shops").select("id, name"),
  ]);

  // Scoped to the listed reports + fetchAllByIds: previously this fetched the
  // WHOLE entries table and silently lost rows past Supabase's 1,000-row cap.
  const reportIds = (reports || []).map((r) => r.id);
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
        .in("shift_report_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const shopNameById = new Map((shops || []).map((s) => [s.id, s.name]));

  // Group entries by report. Use stored game_cost from DB so this list
  // matches the owner dashboard and manager views exactly.
  const entriesByReport = new Map<string, any[]>();
  for (const entry of entries || []) {
    const list = entriesByReport.get(entry.shift_report_id) ?? [];
    list.push(entry);
    entriesByReport.set(entry.shift_report_id, list);
  }

  const totalsByReport = new Map<
    string,
    { recharge: number; normalDifference: number; gameCost: number; profit: number; trueProfit: number }
  >();
  for (const [reportId, group] of entriesByReport) {
    // Canonical formula shared with all owner/manager views.
    const rt = singleReportTotalsFromStoredEntries(group);
    totalsByReport.set(reportId, {
      recharge: rt.totalRecharge,
      normalDifference: rt.totalProfit,
      gameCost: rt.totalGameCost,
      profit: rt.totalProfit,
      trueProfit: rt.totalTrueProfit,
    });
  }

  const cashoutByReport = new Map<string, { amount: number; count: number }>();
  for (const cashout of cashouts || []) {
    const current = cashoutByReport.get(cashout.shift_report_id) || { amount: 0, count: 0 };
    current.amount += Number(cashout.amount || 0);
    current.count += 1;
    cashoutByReport.set(cashout.shift_report_id, current);
  }

  const rows = (reports || []).map((report) => {
    const totals = totalsByReport.get(report.id);
    const cashoutTotals = cashoutByReport.get(report.id);
    return {
      ...report,
      shop_name: shopNameById.get(report.shop_id) || "-",
      real_recharge: formatCurrency(totals?.recharge || 0),
      normal_difference: formatCurrency(totals?.normalDifference || 0),
      game_cost: formatCurrency(totals?.gameCost || 0),
      profit: formatCurrency(totals?.profit || 0),
      cashout_total: formatCurrency(cashoutTotals?.amount || 0),
      cashouts_done: String(cashoutTotals?.count || 0),
      true_profit: formatCurrency(totals?.trueProfit || 0),
    };
  });

  const columns: ColumnConfig[] = [
    { key: "employee_name", label: "Employee" },
    { key: "shop_name", label: "Shop" },
    { key: "shift_date", label: "Date" },
    { key: "shift_interval", label: "Interval" },
    { key: "real_recharge", label: "Real Recharge" },
    { key: "normal_difference", label: "Normal Diff" },
    { key: "game_cost", label: "Game Cost" },
    { key: "profit", label: "Profit" },
    { key: "cashout_total", label: "Cashout" },
    { key: "cashouts_done", label: "Cashouts Done" },
    { key: "true_profit", label: "True Profit" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Shift Reports" />
      <CrudPageClient
        table="shift_reports"
        columns={columns}
        fields={fields}
        rows={rows}
        emptyMessage="No shift reports yet"
        emptyHint="Employees submit shift reports each shift."
        canAdd={false}
        canDelete={false}
        addLabel="Update Status"
      />
    </div>
  );
}
