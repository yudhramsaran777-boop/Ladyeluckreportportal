import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";

export const dynamic = "force-dynamic";

export default async function OwnerPaymentAccountsPage() {
  const supabase = createClient();
  const [{ data: accounts }, { data: shops }] = await Promise.all([
    supabase
      .from("payment_accounts")
      .select("*, shops(name)")
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  const shopOptions = (shops || []).map((s) => ({ label: s.name, value: s.id }));

  const fields: FieldConfig[] = [
    { name: "shop_id", label: "Shop", type: "select", options: shopOptions, required: true },
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
    { name: "payment_link", label: "Payment Link", type: "text", placeholder: "https://cash.app/$YourTag or https://chime.com/pay/yourtag", fullWidth: true },
    { name: "status", label: "Status", type: "toggle-status" },
    { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
  ];

  const columns: ColumnConfig[] = [
    { key: "shops", label: "Shop", render: "relation", relationKey: "shops.name" },
    { key: "payment_type", label: "Type", render: "paymentTypeBadge" },
    { key: "tag", label: "Tag" },
    { key: "email", label: "Email" },
    { key: "payment_link", label: "Payment Link", render: "link" },
    { key: "image_url", label: "Image", render: "image" },
    { key: "password", label: "Password", render: "password" },
    { key: "status", label: "Status", render: "statusBadge" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Accounts" showDateFilter={false} />
      <CrudPageClient
        table="payment_accounts"
        columns={columns}
        fields={fields}
        rows={accounts || []}
        emptyMessage="No payment accounts yet."
        emptyHint="Add a CashApp or Chime account for a shop."
        addLabel="Add Payment Account"
        imageField="image_url"
      />
    </div>
  );
}
