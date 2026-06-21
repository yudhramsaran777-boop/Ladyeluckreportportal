"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Search, Download, RefreshCw } from "lucide-react";
import { usePaymentRealtime } from "@/hooks/use-payment-realtime";
import type {
  ManagerPaymentTransaction,
  ManagerTransactionFilters,
  ActivityType,
} from "@/lib/payment/payment-types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/payment/payment-types";
import { ActivityTypeBadge } from "./activity-type-badge";

interface Props {
  shopId: string;
  paymentAccounts: { id: string; tag: string | null; account_display_name: string | null }[];
  dateStart: string;
  dateEnd: string;
}

const PROVIDERS = ["CashApp", "Chime"] as const;
const ACTIVITY_TYPES: ActivityType[] = [
  "incoming", "outgoing", "request_sent", "request_received", "refunded", "failed",
];
const STATUSES = ["confirmed", "needs_review", "duplicate", "failed", "pending", "refunded"] as const;

function fmtAmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true,
  });
}

export function ManagerTransactionTable({ shopId, paymentAccounts, dateStart, dateEnd }: Props) {
  const [rows, setRows] = useState<ManagerPaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ManagerPaymentTransaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  // Realtime: manager sees all new transactions (not just counted)
  usePaymentRealtime({
    shopId,
    countedOnly: false,
    onNewTransaction: () => setHasNewActivity(true),
  });

  // Filters
  const [filters, setFilters] = useState<Omit<ManagerTransactionFilters, "cursor" | "limit">>({
    dateStart,
    dateEnd,
  });

  function buildParams(extra: Partial<ManagerTransactionFilters> = {}) {
    const f = { ...filters, ...extra };
    const p = new URLSearchParams();
    if (f.dateStart) p.set("date_start", f.dateStart);
    if (f.dateEnd) p.set("date_end", f.dateEnd);
    if (f.provider) p.set("provider", f.provider);
    if (f.activityType) p.set("activity_type", f.activityType);
    if (f.status) p.set("status", f.status);
    if (f.accountId) p.set("account_id", f.accountId);
    if (f.searchTag) p.set("search_tag", f.searchTag);
    if (f.searchPlayer) p.set("search_player", f.searchPlayer);
    if (f.searchNote) p.set("search_note", f.searchNote);
    if (f.amountMin != null) p.set("amount_min", String(f.amountMin));
    if (f.amountMax != null) p.set("amount_max", String(f.amountMax));
    if (extra.cursor) p.set("cursor", extra.cursor);
    p.set("limit", "50");
    return p;
  }

  const load = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const cursor = append ? nextCursor : null;
      const p = buildParams(cursor ? { cursor } : {});
      const res = await fetch(`/api/manager/payments/transactions?${p}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(append ? (prev) => [...prev, ...json.data] : json.data);
      setHasMore(json.hasMore);
      setNextCursor(json.nextCursor ?? null);
      setLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, nextCursor]);

  function applyFilters() {
    setNextCursor(null);
    load(false);
  }

  function resetFilters() {
    setFilters({ dateStart, dateEnd });
    setNextCursor(null);
    setRows([]);
    setLoaded(false);
  }

  function exportCsv() {
    const p = buildParams();
    window.open(`/api/manager/payments/export?${p}`, "_blank");
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { setNextCursor(null); load(false); }}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loaded ? "Refresh" : "Load Transactions"}
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-panelborder px-3 py-2 text-sm text-emerald-200 hover:border-emerald-600 transition-colors"
        >
          Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {loaded && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg border border-panelborder px-3 py-2 text-sm text-emerald-300 hover:border-emerald-600 transition-colors ml-auto"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}

        {/* New-activity banner */}
        {hasNewActivity && loaded && (
          <button
            onClick={() => { setHasNewActivity(false); setNextCursor(null); load(false); }}
            className="w-full rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-xs font-semibold text-positive hover:bg-positive/20 transition-colors"
          >
            ↑ New payment activity — click to refresh
          </button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border border-panelborder bg-panel p-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">From</label>
            <input
              type="date"
              value={filters.dateStart ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateStart: e.target.value || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">To</label>
            <input
              type="date"
              value={filters.dateEnd ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateEnd: e.target.value || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Provider</label>
            <select
              value={filters.provider ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, provider: (e.target.value as typeof PROVIDERS[number]) || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">All providers</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Activity</label>
            <select
              value={filters.activityType ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, activityType: (e.target.value as ActivityType) || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">All types</option>
              {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_TYPE_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Status</label>
            <select
              value={filters.status ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value as typeof STATUSES[number]) || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Account</label>
            <select
              value={filters.accountId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value || null }))}
              className="w-full rounded border border-panelborder bg-zinc-900 px-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">All accounts</option>
              {paymentAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_display_name ?? a.tag ?? a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Search Tag</label>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input
                type="text"
                placeholder="$CashTag…"
                value={filters.searchTag ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, searchTag: e.target.value || null }))}
                className="w-full rounded border border-panelborder bg-zinc-900 pl-6 pr-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-emerald-400 mb-1 block">Search Player</label>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input
                type="text"
                placeholder="Player name…"
                value={filters.searchPlayer ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, searchPlayer: e.target.value || null }))}
                className="w-full rounded border border-panelborder bg-zinc-900 pl-6 pr-2 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div className="col-span-2 lg:col-span-4 flex gap-2 pt-1">
            <button
              onClick={applyFilters}
              className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Apply
            </button>
            <button
              onClick={resetFilters}
              className="rounded-lg border border-panelborder hover:border-emerald-600 px-4 py-2 text-sm text-emerald-300 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loaded && (
        <div className="overflow-x-auto rounded-lg border border-panelborder">
          <table className="w-full text-sm">
            <thead className="border-b border-panelborder bg-zinc-900/60">
              <tr>
                {["Date", "Provider", "Activity / Status", "Amount", "Account", "Counterparty", "Player", "Note"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-panelborder">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-emerald-500 text-sm">
                    No transactions found for selected filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`cursor-pointer transition-colors hover:bg-zinc-800/50 ${selected?.id === r.id ? "bg-zinc-800/70" : ""}`}
                >
                  <td className="px-3 py-2.5 text-emerald-200 whitespace-nowrap text-xs">{fmtDate(r.occurred_at)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${r.provider === "CashApp" ? "bg-emerald-900/40 text-emerald-300" : "bg-purple-900/30 text-purple-300"}`}>
                      {r.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ActivityTypeBadge activityType={r.activity_type} status={r.status} isCounted={r.is_counted} />
                  </td>
                  <td className={`px-3 py-2.5 font-semibold tabular-nums whitespace-nowrap ${r.activity_type === "incoming" ? "text-positive" : r.activity_type === "outgoing" ? "text-danger" : "text-emerald-200"}`}>
                    {fmtAmt(r.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-emerald-400 text-xs">{r.our_account_identifier ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-emerald-200 text-xs">{r.counterparty_tag ?? "—"}</div>
                    {r.counterparty_name && <div className="text-emerald-500 text-xs">{r.counterparty_name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-emerald-300 text-xs">{r.player_name ?? <span className="text-zinc-600">unmatched</span>}</td>
                  <td className="px-3 py-2.5 text-emerald-500 text-xs max-w-xs truncate">{r.payment_note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {loaded && hasMore && (
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="w-full rounded-lg border border-panelborder py-2 text-sm text-emerald-400 hover:border-emerald-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {/* Transaction detail panel */}
      {selected && (
        <TransactionDetailPanel txn={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TransactionDetailPanel({
  txn,
  onClose,
}: {
  txn: ManagerPaymentTransaction;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ["Transaction ID", txn.id],
    ["Date / Time", fmtDate(txn.occurred_at)],
    ["Provider", txn.provider],
    ["Activity Type", ACTIVITY_TYPE_LABELS[txn.activity_type] ?? txn.activity_type],
    ["Status", txn.status],
    ["Amount", fmtAmt(txn.amount)],
    ["Counted in Totals", txn.is_counted ? "Yes" : "No"],
    ["Our Account", txn.our_account_identifier ?? "—"],
    ["Counterparty Tag", txn.counterparty_tag ?? "—"],
    ["Counterparty Name", txn.counterparty_name ?? "—"],
    ["Player", txn.player_name ?? "Unmatched"],
    ["Player Match", txn.player_match_status ?? "—"],
    ["Note", txn.payment_note ?? "—"],
    ["Review Reason", txn.review_reason ?? "—"],
    ["Provider Txn ID", txn.provider_transaction_id ?? "—"],
    ["Email Received", fmtDate(txn.email_received_at)],
  ];

  return (
    <div className="rounded-lg border border-panelborder bg-panel p-5 relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-emerald-500 hover:text-emerald-300 text-sm"
      >
        ✕
      </button>
      <h3 className="text-sm font-semibold text-emerald-200 mb-4">Transaction Detail</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-xs text-emerald-500">{k}</dt>
            <dd className="text-xs text-emerald-100 break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
