// ============================================================================
// Lady E Luck Portal - PaymentActivitySection (Employee Payment Info page)
// Phase 3: Fetches first page of transactions server-side, hands off to
// PaymentActivityClient for client-side filter state and "Load More".
//
// Placed below Active CashApps / Chime on /employee/payment-info, behind
// payment_dashboard_enabled flag (checked in the parent page).
//
// shop_id comes from props, which the parent page derives from the
// authenticated session - it is never taken from URL params.
// ============================================================================

import { getEmployeeTransactions } from "@/lib/payment/payment-server";
import { PaymentActivityClient } from "./payment-activity-client";

interface PaymentActivitySectionProps {
  shopId: string | null;
}

export async function PaymentActivitySection({
  shopId,
}: PaymentActivitySectionProps) {
  if (!shopId) return null;

  // Fetch the first page server-side so the section hydrates with data
  // immediately - no client-side loading spinner on first paint.
  const { data, hasMore, nextCursor } = await getEmployeeTransactions(shopId, {
    limit: 20,
  });

  return (
    <PaymentActivityClient
      initialData={data}
      initialHasMore={hasMore}
      initialNextCursor={nextCursor}
    />
  );
}
