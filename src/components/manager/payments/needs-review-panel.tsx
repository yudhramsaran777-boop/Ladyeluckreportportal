"use client";

import { useState } from "react";
import type { NeedsReviewRow } from "@/lib/payment/payment-types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/payment/payment-types";

interface Props {
  initial: NeedsReviewRow[];
}

function fmtAmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function NeedsReviewPanel({ initial }: Props) {
  const [rows, setRows] = useState<NeedsReviewRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/payments/needs-review");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch {
      setError("Failed to load needs-review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function doAction(txnId: string, action: "confirm" | "mark_duplicate" | "mark_failed") {
    setActionLoading(txnId + action);
    setError(null);
    try {
      const res = await fetch("/api/manager/payments/needs-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txnId, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Action failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== txnId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  if (rows.length === 0 && !loading) {
    return (
      <div className="rounded-lg border border-panelborder bg-panel p-6 text-center">
        <p className="text-emerald-500 text-sm">No items need review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-emerald-400">{rows.length} item{rows.length !== 1 ? "s" : ""} pending review</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-emerald-500 hover:text-emerald-300 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-emerald-200">
                  {r.provider}
                </span>
                {r.activity_type && (
                  <span className="text-xs text-emerald-400">
                    {ACTIVITY_TYPE_LABELS[r.activity_type]}
                  </span>
                )}
                <span className="text-xs text-warning rounded bg-yellow-900/30 px-1.5 py-0.5">
                  {r.status.replace(/_/g, " ")}
                </span>
                <span className="font-semibold text-sm text-gold tabular-nums">{fmtAmt(r.amount)}</span>
              </div>
              <div className="text-xs text-emerald-400">
                {fmtDate(r.occurred_at)}
                {r.counterparty_tag && <span className="ml-2 text-emerald-300">{r.counterparty_tag}</span>}
                {r.counterparty_name && <span className="ml-1 text-emerald-500">({r.counterparty_name})</span>}
              </div>
              {r.payment_note && (
                <div className="text-xs text-emerald-500 italic">&ldquo;{r.payment_note}&rdquo;</div>
              )}
              {r.review_reason && (
                <div className="text-xs text-zinc-500">Reason: {r.review_reason}</div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <button
                onClick={() => doAction(r.id, "confirm")}
                disabled={actionLoading != null}
                className="rounded px-3 py-1.5 text-xs font-medium bg-emerald-800 hover:bg-emerald-700 text-emerald-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading === r.id + "confirm" ? "…" : "Confirm"}
              </button>
              <button
                onClick={() => doAction(r.id, "mark_duplicate")}
                disabled={actionLoading != null}
                className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 disabled:opacity-50 transition-colors"
              >
                {actionLoading === r.id + "mark_duplicate" ? "…" : "Duplicate"}
              </button>
              <button
                onClick={() => doAction(r.id, "mark_failed")}
                disabled={actionLoading != null}
                className="rounded px-3 py-1.5 text-xs font-medium bg-red-900/40 hover:bg-red-900/60 text-red-300 disabled:opacity-50 transition-colors"
              >
                {actionLoading === r.id + "mark_failed" ? "…" : "Failed"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
