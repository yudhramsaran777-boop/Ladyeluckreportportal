"use client";

import { useState } from "react";
import type { TagHistoryEntry } from "@/lib/payment/payment-types";

interface Props {
  initial: TagHistoryEntry[];
}

function fmtAmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

const VERIFICATION_COLORS: Record<string, string> = {
  manager_verified: "text-emerald-400",
  employee_added: "text-blue-400",
  unmatched: "text-zinc-500",
  needs_review: "text-yellow-400",
  conflicting_match: "text-red-400",
  blocked: "text-red-500",
  inactive: "text-zinc-600",
};

export function TagHistoryTable({ initial }: Props) {
  const [search, setSearch] = useState("");
  const [tags] = useState<TagHistoryEntry[]>(initial);

  const filtered = tags.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.payment_tag.toLowerCase().includes(q) ||
      t.player_name?.toLowerCase().includes(q) ||
      t.facebook_name?.toLowerCase().includes(q) ||
      t.game_username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search tag, player, username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-panelborder bg-zinc-900 px-3 py-1.5 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 w-64"
        />
        <span className="text-xs text-emerald-500">{filtered.length} tag{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-panelborder">
        <table className="w-full text-sm">
          <thead className="border-b border-panelborder bg-zinc-900/60">
            <tr>
              {["Provider", "Tag", "Player", "FB Name", "Game", "Verified", "Txns", "In", "Out", "First", "Last"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panelborder">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-emerald-500 text-sm">
                  No tags found.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${t.provider === "CashApp" ? "bg-emerald-900/40 text-emerald-300" : "bg-purple-900/30 text-purple-300"}`}>
                    {t.provider}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-emerald-200 text-xs font-mono">{t.payment_tag}</td>
                <td className="px-3 py-2.5 text-emerald-300 text-xs">{t.player_name ?? "—"}</td>
                <td className="px-3 py-2.5 text-emerald-500 text-xs">{t.facebook_name ?? "—"}</td>
                <td className="px-3 py-2.5 text-emerald-500 text-xs">{t.game_username ?? t.primary_game ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs">
                  <span className={VERIFICATION_COLORS[t.verification_status] ?? "text-zinc-500"}>
                    {t.verification_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-emerald-400 text-xs tabular-nums">{t.transaction_count}</td>
                <td className="px-3 py-2.5 text-positive text-xs tabular-nums">{fmtAmt(t.confirmed_incoming_total)}</td>
                <td className="px-3 py-2.5 text-danger text-xs tabular-nums">{fmtAmt(t.confirmed_outgoing_total)}</td>
                <td className="px-3 py-2.5 text-emerald-600 text-xs whitespace-nowrap">{fmtDate(t.first_seen_at)}</td>
                <td className="px-3 py-2.5 text-emerald-600 text-xs whitespace-nowrap">{fmtDate(t.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
