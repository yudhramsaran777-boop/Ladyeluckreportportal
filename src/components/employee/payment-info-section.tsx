import { createClient } from "@/lib/supabase/server";
import { PaymentCarousel } from "@/components/payment-carousel";
import { EmptyState } from "@/components/empty-state";

export async function PaymentInfoSection({ shopId }: { shopId: string | null }) {
  if (!shopId) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Active CashApps</h2>
          <EmptyState message="No shop assigned to your account yet." />
        </div>
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Active Chime Tags</h2>
          <EmptyState message="No shop assigned to your account yet." />
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: accounts } = await supabase
    .from("payment_accounts")
    .select("*")
    .eq("shop_id", shopId)
    .eq("status", "active");

  const normalizedAccounts = (accounts || []).map((account) => {
    const paymentTypeKey = String(account.payment_type || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");
    return {
      ...account,
      payment_type:
        paymentTypeKey === "chime" || paymentTypeKey === "chimetag" ? "Chime" : "CashApp",
    };
  });

  const cashApps = normalizedAccounts.filter((a) => a.payment_type === "CashApp");
  const chimes = normalizedAccounts.filter((a) => a.payment_type === "Chime");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PaymentCarousel title="Active CashApps" accounts={cashApps} emptyMessage="No active CashApps assigned." />
      <PaymentCarousel title="Active Chime Tags" accounts={chimes} emptyMessage="No active Chime tags assigned." />
    </div>
  );
}
