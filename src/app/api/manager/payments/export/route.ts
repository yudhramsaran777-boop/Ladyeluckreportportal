// ============================================================================
// Lady E Luck Portal — GET /api/manager/payments/export
// CSV export of confirmed payment transactions for manager/owner.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentFeatureFlags } from "@/lib/payment/feature-flags";
import { getManagerTransactions } from "@/lib/payment/manager-queries";
import type { ManagerTransactionFilters } from "@/lib/payment/payment-types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/payment/payment-types";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(cols: unknown[]): string {
  return cols.map(escapeCsv).join(",");
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, shop_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.shop_id || profile.role === "employee") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const flags = await getPaymentFeatureFlags(profile.shop_id);
  if (!flags.manager_payment_summary_enabled) {
    return new NextResponse("Feature not enabled", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const rawStart = sp.get("date_start");
  const rawEnd = sp.get("date_end");

  const filters: ManagerTransactionFilters = {
    limit: 1000,
    dateStart: rawStart && DATE_RE.test(rawStart) ? rawStart : null,
    dateEnd: rawEnd && DATE_RE.test(rawEnd) ? rawEnd : null,
    provider: null,
    activityType: null,
    status: null,
  };

  const { data: txns } = await getManagerTransactions(profile.shop_id, filters);

  const headers = [
    "Date", "Provider", "Activity", "Status",
    "Amount", "Our Account", "Counterparty Tag", "Counterparty Name",
    "Player", "Note", "Is Counted",
  ];

  const lines = [
    headers.join(","),
    ...txns.map((t) =>
      rowToCsv([
        t.occurred_at ? new Date(t.occurred_at).toISOString() : "",
        t.provider,
        ACTIVITY_TYPE_LABELS[t.activity_type] ?? t.activity_type,
        t.status,
        t.amount.toFixed(2),
        t.our_account_identifier ?? "",
        t.counterparty_tag ?? "",
        t.counterparty_name ?? "",
        t.player_name ?? "",
        t.payment_note ?? "",
        t.is_counted ? "Yes" : "No",
      ])
    ),
  ];

  const csv = lines.join("\n");
  const filename = `payments-${rawStart ?? "all"}-to-${rawEnd ?? "all"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
