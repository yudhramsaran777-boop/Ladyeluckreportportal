import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PaymentInfoSection } from "@/components/employee/payment-info-section";
import { GameLoginsSection } from "@/components/employee/game-logins-section";
import { ShiftReportClient } from "@/components/employee/shift-report-client";
import { LivePaymentActivityPreview } from "@/components/employee/live-payment-activity-preview";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboardPage() {
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

  const paymentFlags = await getPaymentFeatureFlags(shopId);

  let debugCashAppCount = 0;
  let debugChimeCount = 0;
  let debugGameAccountCount = 0;
  if (shopId) {
    const [{ count: cashAppCount }, { count: chimeCount }, { count: gameCount }] = await Promise.all([
      supabase
        .from("payment_accounts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("payment_type", "CashApp")
        .eq("status", "active"),
      supabase
        .from("payment_accounts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("payment_type", "Chime")
        .eq("status", "active"),
      supabase
        .from("game_accounts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .ilike("status", "active"),
    ]);
    debugCashAppCount = cashAppCount ?? 0;
    debugChimeCount = chimeCount ?? 0;
    debugGameAccountCount = gameCount ?? 0;
  }

  const [{ data: gameSettings }, { data: pageSources }, { data: draftReport }] = await Promise.all([
    supabase.from("game_settings").select("game_code, game_name, cost_percentage"),
    shopId
      ? supabase
          .from("page_sources")
          .select("id, page_name, platform")
          .eq("shop_id", shopId)
          .ilike("status", "active")
          .order("page_name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("shift_reports")
      .select("id, shift_date, shift_interval, status, notes")
      .eq("employee_id", employeeId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let initialEntries: any[] = [];
  let initialCashouts: any[] = [];

  if (draftReport) {
    const [{ data: entries }, { data: cashouts }] = await Promise.all([
      supabase
        .from("shift_game_entries")
        .select("*")
        .eq("shift_report_id", draftReport.id),
      supabase
        .from("shift_cashouts")
        .select("*")
        .eq("shift_report_id", draftReport.id)
        .order("created_at", { ascending: true }),
    ]);
    initialEntries = entries || [];
    initialCashouts = cashouts || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Employee Dashboard" showDateFilter={false} />
      <div className="card-panel p-4">
        <h1 className="text-lg font-semibold text-white">
          Welcome, {employeeName}
        </h1>
        <p className="mt-1 text-sm text-emerald-200/60">
          Here is your dashboard. Use the sidebar to navigate.
        </p>
        {shopId && (
          <p className="mt-1 text-xs text-emerald-200/40">
            CashApps: {debugCashAppCount} active · Chime: {debugChimeCount} active · Games: {debugGameAccountCount} active
          </p>
        )}
      </div>

      {/* PAYMENT ACTIVITY PREVIEW - flag-gated, Phase 1 shell renders null */}
      {paymentFlags.payment_dashboard_enabled && (
        <LivePaymentActivityPreview shopId={shopId} />
      )}

      <PaymentInfoSection shopId={shopId} />
      <GameLoginsSection shopId={shopId} />
      <ShiftReportClient
        shopId={shopId || ""}
        employeeId={employeeId}
        employeeName={employeeName}
        gameSettings={gameSettings || []}
        pageSources={pageSources || []}
        initialReport={draftReport || null}
        initialEntries={initialEntries}
        initialCashouts={initialCashouts}
      />
    </div>
  );
}
