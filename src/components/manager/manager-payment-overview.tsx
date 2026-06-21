// ============================================================================
// Lady E Luck Portal — Manager Payment Overview (Manager Dashboard widget)
// Shows today's payment KPI summary; links to /manager/payments.
// Only renders when manager_payment_summary_enabled = true.
// ============================================================================

import Link from "next/link";
import { getManagerPaymentTotals } from "@/lib/payment/manager-queries";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";

interface ManagerPaymentOverviewProps {
  shopId: string;
  start: string;
  end: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export async function ManagerPaymentOverview({
  shopId,
  start,
  end,
}: ManagerPaymentOverviewProps) {
  const flags = await getPaymentFeatureFlags(shopId);
  if (!flags.manager_payment_summary_enabled) return null;

  const totals = await getManagerPaymentTotals(shopId, start, end);

  const netVariant =
    totals.net_activity > 0
      ? "text-positive"
      : totals.net_activity < 0
      ? "text-danger"
      : "text-emerald-200";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
          Payment Activity &middot; Today
        </h2>
        <Link
          href="/manager/payments"
          className="text-xs text-gold hover:text-gold/80 underline underline-offset-2"
        >
          Open Payments Dashboard
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-1">
          <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">Incoming</p>
          <p className="text-xl font-bold tabular-nums text-positive">{fmt(totals.incoming_total)}</p>
          <p className="text-xs text-emerald-600">
            CA {fmt(totals.incoming_cashapp)} &middot; Ch {fmt(totals.incoming_chime)}
          </p>
        </div>
        <div className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-1">
          <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">Outgoing</p>
          <p className="text-xl font-bold tabular-nums text-danger">{fmt(totals.outgoing_total)}</p>
          <p className="text-xs text-emerald-600">
            CA {fmt(totals.outgoing_cashapp)} &middot; Ch {fmt(totals.outgoing_chime)}
          </p>
        </div>
        <div className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-1">
          <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">Net</p>
          <p className={`text-xl font-bold tabular-nums ${netVariant}`}>{fmt(totals.net_activity)}</p>
          <p className="text-xs text-emerald-600">Confirmed only</p>
        </div>
        <div className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-1">
          <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">Review</p>
          <p className={`text-xl font-bold tabular-nums ${totals.needs_review_count > 0 ? "text-warning" : "text-emerald-200"}`}>
            {totals.needs_review_count}
          </p>
          <p className="text-xs text-emerald-600">{totals.failed_count} failed &middot; {totals.duplicate_count} dup</p>
        </div>
      </div>
    </section>
  );
}
