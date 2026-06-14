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
        .select("shift_report_id, real_recharge, true_profit"),
      supabase.from("shift_cashouts").select("shift_report_id, amount"),
    ]);

  const shopNameById = new Map((shops || []).map((s) => [s.id, s.name]));

  const totalsByReport = new Map<string, { recharge: number; profit: number }>();
  for (const e of entries || []) {
    const cur = totalsByReport.get(e.shift_report_id) || { recharge: 0, profit: 0 };
    cur.recharge += Number(e.real_recharge || 0);
    cur.profit += Number(e.true_profit || 0);
    totalsByReport.set(e.shift_report_id, cur);
  }

  const cashoutByReport = new Map<string, number>();
  for (const c of cashouts || []) {
    cashoutByReport.set(
      c.shift_report_id,
      (cashoutByReport.get(c.shift_report_id) || 0) + Number(c.amount || 0)
    );
  }

  const rows = (reports || []).map((r) => ({
    ...r,
    shop_name: shopNameById.get(r.shop_id) || "—",
    real_recharge: formatCurrency(totalsByReport.get(r.id)?.recharge || 0),
    cashout_total: formatCurrency(cashoutByReport.get(r.id) || 0),
    true_profit: formatCurrency(totalsByReport.get(r.id)?.profit || 0),
  }));

  const columns: ColumnConfig[] = [
    { key: "employee_name", label: "Employee" },
    { key: "shop_name", label: "Shop" },
    { key: "shift_date", label: "Date" },
    { key: "shift_interval", label: "Interval" },
    { key: "real_recharge", label: "Real Recharge" },
    { key: "cashout_total", label: "Cashout" },
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
