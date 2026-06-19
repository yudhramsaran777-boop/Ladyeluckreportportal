import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PaymentInfoSection } from "@/components/employee/payment-info-section";
import { PaymentActivitySection } from "@/components/employee/payment-activity-section";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";

export const dynamic = "force-dynamic";

export default async function EmployeePaymentInfoPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userData.user!.id)
    .single();

  const shopId = profile?.shop_id || null;
  const paymentFlags = await getPaymentFeatureFlags(shopId);

  return (
    <div className="space-y-6">
      <PageHeader title="CashApp / Chime" showDateFilter={false} />
      {!shopId && (
        <div className="card-panel p-4">
          <EmptyState
            message="Employee is not assigned to a shop. Contact the owner."
            hint="Ask your manager or owner to assign you to a shop."
          />
        </div>
      )}
      <PaymentInfoSection shopId={shopId} />

      {/* PAYMENT ACTIVITY - flag-gated, Phase 1 shell renders null */}
      {paymentFlags.payment_dashboard_enabled && (
        <PaymentActivitySection shopId={shopId} />
      )}
    </div>
  );
}
