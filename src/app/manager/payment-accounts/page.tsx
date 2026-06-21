import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CrudPageClient } from "@/components/crud/crud-page-client";
import { PaymentAccountGmailManager } from "@/components/manager/payment-account-gmail-manager";
import { PlayerMappingReviewSection } from "@/components/manager/player-mapping-review-section";
import { RechargeReviewSection } from "@/components/manager/recharge-review-section";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import type { ColumnConfig, FieldConfig } from "@/components/crud/types";
import type { ManagerRechargeRow, RechargeStatus } from "@/lib/payment/payment-types";

export const dynamic = "force-dynamic";

// Map DB recharge_status to TS RechargeStatus
function mapDbStatus(db: string): RechargeStatus {
  switch (db) {
    case "bonus_given":       return "completed_with_bonus";
    case "exact":             return "completed_no_bonus";
    case "missing_recharge":  return "under_recharged";
    case "voided":            return "voided";
    default:                  return "needs_review";
  }
}

// DB row shape from the recharges + joins query
interface RechargeDbRow {
  id: string;
  shop_id: string;
  payment_transaction_id: string;
  employee_id: string | null;
  player_id: string | null;
  game_id: string | null;
  game_username: string | null;
  cash_received: string | number;
  coins_recharged: string | number;
  bonus_given: string | number;
  missing_recharge: string | number;
  recharge_status: string;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  employee: { full_name: string | null } | null;
  voided_by_profile: { full_name: string | null } | null;
  game: { game_name: string | null } | null;
  transaction: { occurred_at: string | null; player_mapping_id: string | null } | null;
  player_mapping: { player_name: string | null } | null;
}

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

  const [{ data: accounts }, { data: rechargeRows }] = await Promise.all([
    supabase
      .from("payment_accounts")
      .select("*")
      .eq("shop_id", profile.shop_id)
      .order("created_at", { ascending: false }),
    paymentFlags.payment_dashboard_enabled
      ? supabase
          .from("payment_recharges")
          .select(
            "id, shop_id, payment_transaction_id, employee_id, player_id, game_id, " +
            "game_username, cash_received, coins_recharged, bonus_given, missing_recharge, " +
            "recharge_status, notes, voided_at, voided_by, created_at, " +
            "employee:profiles!employee_id(full_name), " +
            "voided_by_profile:profiles!voided_by(full_name), " +
            "game:games!game_id(game_name), " +
            "transaction:payment_transactions!payment_transaction_id(occurred_at, player_mapping_id)"
          )
          .eq("shop_id", profile.shop_id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Build ManagerRechargeRow[] for the recharge review section
  // We do a second pass to look up player names from player_payment_tags
  let managerRecharges: ManagerRechargeRow[] = [];
  if (paymentFlags.payment_dashboard_enabled && rechargeRows) {
    const rows = rechargeRows as unknown as RechargeDbRow[];

    // Collect mapping IDs to batch-fetch player names
    const mappingIds = [
      ...new Set(
        rows
          .map((r) => r.transaction?.player_mapping_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const mappingNameMap = new Map<string, string | null>();
    if (mappingIds.length > 0) {
      const { data: mappings } = await supabase
        .from("player_payment_tags")
        .select("id, player_name")
        .in("id", mappingIds)
        .returns<{ id: string; player_name: string | null }[]>();
      for (const m of mappings ?? []) {
        mappingNameMap.set(m.id, m.player_name);
      }
    }

    managerRecharges = rows.map((r): ManagerRechargeRow => {
      const mappingId = r.transaction?.player_mapping_id ?? null;
      const employeeObj = r.employee as { full_name: string | null } | null;
      const voidedObj = r.voided_by_profile as { full_name: string | null } | null;
      const gameObj = r.game as { game_name: string | null } | null;
      const txnObj = r.transaction as { occurred_at: string | null } | null;

      return {
        id: r.id,
        shop_id: r.shop_id,
        payment_transaction_id: r.payment_transaction_id,
        employee_id: r.employee_id,
        employee_name: employeeObj?.full_name ?? null,
        player_name: mappingId ? (mappingNameMap.get(mappingId) ?? null) : null,
        game_name: gameObj?.game_name ?? null,
        game_username: r.game_username,
        cash_received: Number(r.cash_received),
        coins_recharged: Number(r.coins_recharged),
        bonus_given: Number(r.bonus_given),
        missing_recharge: Number(r.missing_recharge),
        recharge_status: mapDbStatus(r.recharge_status),
        notes: r.notes,
        voided_at: r.voided_at,
        voided_by: r.voided_by,
        voided_by_name: voidedObj?.full_name ?? null,
        created_at: r.created_at,
        transaction_occurred_at: txnObj?.occurred_at ?? null,
      };
    });
  }

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

      {/* PLAYER MAPPING REVIEW - flag-gated, Phase 4 */}
      {paymentFlags.payment_dashboard_enabled && (
        <PlayerMappingReviewSection shopId={profile.shop_id} />
      )}

      {/* RECHARGE REVIEW - flag-gated, Phase 5 */}
      {paymentFlags.payment_dashboard_enabled && (
        <RechargeReviewSection initialRecharges={managerRecharges} />
      )}

      {/* GMAIL MANAGER - flag-gated, Phase 1 shell renders null */}
      {paymentFlags.gmail_sync_enabled && (
        <PaymentAccountGmailManager shopId={profile.shop_id} />
      )}
    </div>
  );
}
