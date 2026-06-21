"use client";

import type { ManagerPaymentTotals } from "@/lib/payment/payment-types";

interface Props {
  totals: ManagerPaymentTotals;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function Card({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "positive" | "danger" | "warning" | "gold";
}) {
  const valueClass =
    variant === "positive"
      ? "text-positive"
      : variant === "danger"
      ? "text-danger"
      : variant === "warning"
      ? "text-warning"
      : variant === "gold"
      ? "text-gold"
      : "text-emerald-100";

  return (
    <div className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-1">
      <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-emerald-500">{sub}</p>}
    </div>
  );
}

export function PaymentTotalsCards({ totals }: Props) {
  const netVariant =
    totals.net_activity > 0 ? "positive" : totals.net_activity < 0 ? "danger" : "default";

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card
        label="Total Incoming"
        value={fmt(totals.incoming_total)}
        sub={`CashApp ${fmt(totals.incoming_cashapp)} · Chime ${fmt(totals.incoming_chime)}`}
        variant="positive"
      />
      <Card
        label="Total Outgoing"
        value={fmt(totals.outgoing_total)}
        sub={`CashApp ${fmt(totals.outgoing_cashapp)} · Chime ${fmt(totals.outgoing_chime)}`}
        variant="danger"
      />
      <Card
        label="Net Activity"
        value={fmt(totals.net_activity)}
        sub="Confirmed only"
        variant={netVariant}
      />
      <Card
        label="Needs Review"
        value={String(totals.needs_review_count)}
        sub={`${totals.failed_count} failed · ${totals.duplicate_count} duplicate`}
        variant={totals.needs_review_count > 0 ? "warning" : "default"}
      />
    </div>
  );
}

export function PaymentSecondaryCards({ totals }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card
        label="Requests Sent"
        value={`${totals.request_sent_count}`}
        sub={fmt(totals.request_sent_total)}
      />
      <Card
        label="Requests Received"
        value={`${totals.request_received_count}`}
        sub={fmt(totals.request_received_total)}
      />
      <Card
        label="Refunds"
        value={`${totals.refunded_count}`}
        sub={fmt(totals.refunded_total)}
        variant={totals.refunded_count > 0 ? "warning" : "default"}
      />
      <Card
        label="Duplicates Found"
        value={`${totals.duplicate_count}`}
        sub="Not counted in totals"
      />
    </div>
  );
}
