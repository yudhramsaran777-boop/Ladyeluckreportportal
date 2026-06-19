// ============================================================================
// Lady E Luck Portal - LivePaymentActivityPreview (Employee Dashboard)
// Phase 3: Fetches up to 8 most recent counted transactions server-side.
//
// Placed below the Welcome card on /employee, behind payment_dashboard_enabled.
// shop_id comes from props - the parent page derives it from the authenticated
// session. It is never taken from URL params.
// ============================================================================

import Link from "next/link";
import { getEmployeeTransactions } from "@/lib/payment/payment-server";
import { PaymentTransactionTable } from "@/components/payment/payment-transaction-table";

interface LivePaymentActivityPreviewProps {
  shopId: string | null;
}

export async function LivePaymentActivityPreview({
  shopId,
}: LivePaymentActivityPreviewProps) {
  if (!shopId) return null;

  const { data: transactions } = await getEmployeeTransactions(shopId, {
    limit: 8,
  });

  return (
    <div className="card-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-panelborder px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Live Payment Activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-emerald-200/50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-positive" />
          Live
        </span>
      </div>

      {/* Transaction rows */}
      <PaymentTransactionTable
        transactions={transactions}
        showDate={false}
        emptyMessage="No counted payment transactions yet."
      />

      {/* Footer link */}
      <div className="border-t border-panelborder px-4 py-3 text-right">
        <Link
          href="/employee/payment-info#payment-activity"
          className="text-xs font-semibold text-gold transition-colors hover:text-gold-light"
        >
          View All Payments
        </Link>
      </div>
    </div>
  );
}
