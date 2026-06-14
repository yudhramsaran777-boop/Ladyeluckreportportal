import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ShiftReportClient } from "@/components/employee/shift-report-client";

export const dynamic = "force-dynamic";

export default async function EmployeeShiftReportPage({
  searchParams,
}: {
  searchParams: { reportId?: string };
}) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, shop_id")
    .eq("id", userData.user!.id)
    .single();

  const shopId = profile?.shop_id || null;
  const employeeId = profile?.id || userData.user!.id;
  const employeeName = profile?.full_name || "Employee";

  if (!shopId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Submit Shift Report" showDateFilter={false} />
        <div className="card-panel p-4">
          <EmptyState
            message="No shop assigned to your account yet"
            hint="Ask your manager or owner to assign you to a shop."
          />
        </div>
      </div>
    );
  }

  const [{ data: gameSettings }, { data: pageSources }] = await Promise.all([
    supabase.from("game_settings").select("game_code, game_name, cost_percentage"),
    supabase
      .from("page_sources")
      .select("id, page_name")
      .eq("shop_id", shopId)
      .eq("status", "active")
      .order("page_name"),
  ]);

  // If a specific reportId is provided (e.g. via My Reports → Edit button),
  // load that report (must belong to this employee). Otherwise load the most
  // recent report (any status); the client decides editability from `status`.
  const reportId = searchParams?.reportId;

  const { data: activeReport } = reportId
    ? await supabase
        .from("shift_reports")
        .select("id, shift_date, shift_interval, status, notes")
        .eq("id", reportId)
        .eq("employee_id", employeeId)
        .maybeSingle()
    : await supabase
        .from("shift_reports")
        .select("id, shift_date, shift_interval, status, notes")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  let initialEntries: any[] = [];
  let initialCashouts: any[] = [];

  if (activeReport) {
    const [{ data: entries }, { data: cashouts }] = await Promise.all([
      supabase.from("shift_game_entries").select("*").eq("shift_report_id", activeReport.id),
      supabase
        .from("shift_cashouts")
        .select("*")
        .eq("shift_report_id", activeReport.id)
        .order("created_at", { ascending: true }),
    ]);
    initialEntries = entries || [];
    initialCashouts = cashouts || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Submit Shift Report" showDateFilter={false} />
      <ShiftReportClient
        shopId={shopId}
        employeeId={employeeId}
        employeeName={employeeName}
        gameSettings={gameSettings || []}
        pageSources={pageSources || []}
        initialReport={activeReport || null}
        initialEntries={initialEntries}
        initialCashouts={initialCashouts}
      />
    </div>
  );
}
