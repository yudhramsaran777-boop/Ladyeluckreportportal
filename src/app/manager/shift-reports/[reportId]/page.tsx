import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ShiftReportClient } from "@/components/employee/shift-report-client";

export const dynamic = "force-dynamic";

export default async function ManagerShiftReportEditPage({
  params,
}: {
  params: { reportId: string };
}) {
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
        <PageHeader title="Edit Shift Report" showDateFilter={false} />
        <EmptyState message="No shop assigned. Contact owner." />
      </div>
    );
  }

  const { data: report } = await supabase
    .from("shift_reports")
    .select("id, shop_id, employee_id, employee_name, shift_date, shift_interval, status, notes")
    .eq("id", params.reportId)
    .eq("shop_id", profile.shop_id)
    .maybeSingle();

  if (!report) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Shift Report" showDateFilter={false} />
        <EmptyState
          message="Report not found"
          hint="This report may belong to another shop or may have been removed."
        />
      </div>
    );
  }

  const [{ data: gameSettings }, { data: pageSources }, { data: entries }, { data: cashouts }] =
    await Promise.all([
      supabase.from("game_settings").select("game_code, game_name, cost_percentage"),
      supabase
        .from("page_sources")
        .select("id, page_name")
        .eq("shop_id", profile.shop_id)
        .eq("status", "active")
        .order("page_name"),
      supabase.from("shift_game_entries").select("*").eq("shift_report_id", report.id),
      supabase
        .from("shift_cashouts")
        .select("*")
        .eq("shift_report_id", report.id)
        .eq("shop_id", profile.shop_id)
        .order("created_at", { ascending: true }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Edit Shift Report" showDateFilter={false} />
        <Link
          href="/manager/shift-reports"
          className="text-sm font-semibold text-gold hover:text-gold-light"
        >
          Back to Shift Reports
        </Link>
      </div>
      <ShiftReportClient
        shopId={profile.shop_id}
        employeeId={report.employee_id}
        employeeName={report.employee_name || "Employee"}
        gameSettings={gameSettings || []}
        pageSources={pageSources || []}
        initialReport={report}
        initialEntries={entries || []}
        initialCashouts={cashouts || []}
        editorRole="manager"
      />
    </div>
  );
}
