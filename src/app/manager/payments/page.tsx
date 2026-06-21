// ============================================================================
// Lady E Luck Portal — Manager Payments Dashboard
// Route: /manager/payments
//
// SECURITY:
//   - Manager layout already enforces manager-only access (redirects employees)
//   - Additionally gated by manager_payment_summary_enabled feature flag
//   - All data fetched server-side using shop_id from authenticated session
//   - ManagerPaymentTotals, ManagerPaymentTransaction, etc. never sent to employees
// ============================================================================

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import {
  getManagerPaymentTotals,
  getNeedsReview,
  getSyncLogs,
  getGmailConnections,
  getTagHistory,
} from "@/lib/payment/manager-queries";
import { PageHeader } from "@/components/page-header";
import { PaymentTotalsCards, PaymentSecondaryCards } from "@/components/manager/payments/payment-totals-cards";
import { ManagerTransactionTable } from "@/components/manager/payments/transaction-table";
import { NeedsReviewPanel } from "@/components/manager/payments/needs-review-panel";
import { TagHistoryTable } from "@/components/manager/payments/tag-history-table";
import { SyncStatusPanel } from "@/components/manager/payments/sync-status-panel";

export const dynamic = "force-dynamic";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type SectionTab = "activity" | "customers" | "needs-review" | "sync";

interface SearchParams {
  tab?: SectionTab;
}

export default async function ManagerPaymentsDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // ---- Auth ----------------------------------------------------------------
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role === "employee") redirect("/dashboard");

  if (!profile.shop_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments Dashboard" showDateFilter={false} />
        <div className="rounded-lg border border-panelborder bg-panel p-8 text-center">
          <p className="text-emerald-400">No shop assigned. Ask the owner to assign you to a shop.</p>
        </div>
      </div>
    );
  }

  // ---- Feature flag check --------------------------------------------------
  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments Dashboard" showDateFilter={false} />
        <div className="rounded-lg border border-panelborder bg-panel p-8 text-center">
          <p className="text-emerald-400 font-medium mb-2">Payments Dashboard not yet enabled</p>
          <p className="text-emerald-600 text-sm">
            An owner must enable <code className="text-gold">manager_payment_summary_enabled</code> in shop feature flags to activate this dashboard.
          </p>
        </div>
      </div>
    );
  }

  // ---- Server-side data ----------------------------------------------------
  const todayStr = today();
  const activeTab = (searchParams.tab ?? "activity") as SectionTab;

  // Fetch concurrently
  const [totals, needsReview, syncLogs, connections, tagHistory, accountsRes] =
    await Promise.all([
      getManagerPaymentTotals(profile.shop_id, todayStr, todayStr),
      getNeedsReview(profile.shop_id),
      getSyncLogs(profile.shop_id, 30),
      getGmailConnections(profile.shop_id),
      getTagHistory(profile.shop_id),
      supabase
        .from("payment_accounts")
        .select("id, tag, account_display_name")
        .eq("shop_id", profile.shop_id)
        .eq("status", "active"),
    ]);

  const paymentAccounts = (accountsRes.data ?? []) as {
    id: string;
    tag: string | null;
    account_display_name: string | null;
  }[];

  const tabs: { id: SectionTab; label: string; count?: number }[] = [
    { id: "activity", label: "Activity" },
    { id: "customers", label: "Customers & Tags", count: tagHistory.length },
    { id: "needs-review", label: "Needs Review", count: needsReview.length },
    { id: "sync", label: "Sync Status" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments Dashboard" showDateFilter={false} />

      {/* ---- Today's Summary Cards ---------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
            Today · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <div className="flex gap-3 text-xs text-emerald-600">
            <span>Confirmed totals only</span>
            {flags.gmail_sync_enabled && (
              <span className="text-emerald-500">● Gmail sync active</span>
            )}
          </div>
        </div>
        <PaymentTotalsCards totals={totals} />
        <PaymentSecondaryCards totals={totals} />
      </section>

      {/* ---- Tabbed sections ---------------------------------------------- */}
      <section className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-panelborder">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`/manager/payments?tab=${t.id}`}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === t.id
                  ? "border-gold text-gold"
                  : "border-transparent text-emerald-500 hover:text-emerald-300"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${activeTab === t.id ? "bg-gold/20 text-gold" : "bg-zinc-700 text-zinc-400"}`}>
                  {t.count}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "activity" && (
            <ManagerTransactionTable
              shopId={profile.shop_id}
              paymentAccounts={paymentAccounts}
              dateStart={todayStr}
              dateEnd={todayStr}
            />
          )}

          {activeTab === "customers" && (
            <TagHistoryTable initial={tagHistory} />
          )}

          {activeTab === "needs-review" && (
            <NeedsReviewPanel initial={needsReview} />
          )}

          {activeTab === "sync" && (
            <SyncStatusPanel syncLogs={syncLogs} connections={connections} />
          )}
        </div>
      </section>
    </div>
  );
}
