import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import { PaymentAccountGmailManager } from "@/components/manager/payment-account-gmail-manager";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

const fields: FieldConfig[] = [
  {
    name: "payment_type",
    label: "Type",
    type: "select",
    options: [
      { label: "CashApp", value: "CashApp" },
      { label: "Chime", value: "Chime" },
    ],
    required: true,
  },
  { name: "tag", label: "Tag", type: "text", placeholder: "$CashTag or ChimeTag" },
  { name: "email", label: "Email", type: "text" },
  { name: "password", label: "Password", type: "password" },
  { name: "image_url", label: "Account Image", type: "image", fullWidth: true },
  {
    name: "payment_link",
    label: "Payment Link",
    type: "text",
    placeholder: "https://cash.app/$YourTag or https://chime.com/pay/yourtag",
    fullWidth: true,
  },
  { name: "status", label: "Status", type: "toggle-status" },
  { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
];

const columns: ColumnConfig[] = [
  { key: "payment_type", label: "Type", render: "paymentTypeBadge" },
  { key: "tag", label: "Tag" },
  { key: "email", label: "Email" },
  { key: "payment_link", label: "Payment Link", render: "link" },
  { key: "image_url", label: "Image", render: "image" },
  { key: "password", label: "Password", render: "password" },
  { key: "status", label: "Status", render: "statusBadge" },
];

export default async function ManagerPaymentAccountsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, shop_id")
    .eq("id", userData.user!.id)
    .single();

  if (!profile?.shop_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payment Accounts" showDateFilter={false} />
        <EmptyState
          message="Manager is not assigned to a shop. Owner must assign this manager to a shop first."
          hint="Ask the owner to assign you to a shop."
        />
      </div>
    );
  }

  const paymentFlags = await getPaymentFeatureFlags(profile.shop_id);

  const { data: accounts } = await supabase
    .from("payment_accounts")
    .select("*")
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Accounts" showDateFilter={false} />
      <CrudPageClient
        table="payment_accounts"
        columns={columns}
        fields={fields}
        rows={accounts || []}
        emptyMessage="No payment accounts yet."
        emptyHint="Add a CashApp or Chime account for your shop."
        addLabel="Add Payment Account"
        fixedValues={{ shop_id: profile.shop_id }}
        imageField="image_url"
      />

      {/* GMAIL MANAGER - flag-gated, Phase 1 shell renders null */}
      {paymentFlags.gmail_sync_enabled && (
        <PaymentAccountGmailManager shopId={profile.shop_id} />
      )}
    </div>
  );
}
