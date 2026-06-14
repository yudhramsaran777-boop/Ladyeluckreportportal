import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import { formatCurrency } from "@/lib/calculations";
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

  const [{ data: reports }, { data: shops }, { data: entries }, { data: cashouts }] =
    await Promise.all([
      supabase
        .from("shift_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("shops").select("id, name"),
      supabase
        .from("shift_game_entries")
        .select("shift_report_id, real_recharge, normal_coin_difference, game_cost, true_profit"),
      supabase.from("shift_cashouts").select("shift_report_id, amount"),
    ]);

  const shopNameById = new Map((shops || []).map((s) => [s.id, s.name]));

  const totalsByReport = new Map<
    string,
    { recharge: number; normalDifference: number; gameCost: number; profit: number; trueProfit: number }
  >();

  for (const entry of entries || []) {
    const current = totalsByReport.get(entry.shift_report_id) || {
      recharge: 0,
      normalDifference: 0,
      gameCost: 0,
      profit: 0,
      trueProfit: 0,
    };
    const normalDifference = Number(entry.normal_coin_difference || 0);
    const gameCost = Number(entry.game_cost || 0);
    current.recharge += Number(entry.real_recharge || 0);
    current.normalDifference += normalDifference;
    current.gameCost += gameCost;
    current.profit += normalDifference;
    current.trueProfit += normalDifference || gameCost ? normalDifference - gameCost : Number(entry.true_profit || 0);
    totalsByReport.set(entry.shift_report_id, current);
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
