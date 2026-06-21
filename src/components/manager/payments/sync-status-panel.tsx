"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import type { SyncLogRow, GmailConnectionRow } from "@/lib/payment/payment-types";

interface Props {
  syncLogs: SyncLogRow[];
  connections: GmailConnectionRow[];
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle size={14} className="text-positive shrink-0" />;
  if (status === "failed") return <AlertCircle size={14} className="text-danger shrink-0" />;
  return <Clock size={14} className="text-yellow-400 shrink-0 animate-pulse" />;
}

function ConnectionStatusBadge({ status }: { status: string }) {
  const cls =
    status === "connected" ? "bg-emerald-900/40 text-emerald-400" :
    status === "disconnected" ? "bg-zinc-700 text-zinc-400" :
    "bg-yellow-900/30 text-yellow-400";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function SyncStatusPanel({ syncLogs: initialLogs, connections: initialConnections }: Props) {
  const [syncLogs, setSyncLogs] = useState(initialLogs);
  const [connections, setConnections] = useState(initialConnections);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/payments/sync-status");
      const json = await res.json();
      setSyncLogs(json.syncLogs ?? []);
      setConnections(json.connections ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualSync(connectionId: string) {
    setTriggerLoading(connectionId);
    try {
      await fetch("/api/manager/payments/manual-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      await refresh();
    } finally {
      setTriggerLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Gmail Connections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-emerald-200">Gmail Connections</h3>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-300 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {connections.length === 0 ? (
          <p className="text-sm text-emerald-500">No Gmail connections configured.</p>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="rounded-lg border border-panelborder bg-panel p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-emerald-200 font-medium">{c.email_address}</span>
                    <ConnectionStatusBadge status={c.connection_status} />
                    {c.payment_account_label && (
                      <span className="text-xs text-emerald-500">({c.payment_account_label})</span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-600 space-x-4">
                    <span>Last sync: {fmtDate(c.last_synced_at)}</span>
                    {c.watch_expires_at && (
                      <span>Watch expires: {fmtDate(c.watch_expires_at)}</span>
                    )}
                  </div>
                  {c.last_error_message && (
                    <div className="text-xs text-danger">{c.last_error_message}</div>
                  )}
                </div>
                {c.connection_status === "connected" && (
                  <button
                    onClick={() => triggerManualSync(c.id)}
                    disabled={triggerLoading != null}
                    className="flex items-center gap-1.5 shrink-0 rounded px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-emerald-300 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={12} className={triggerLoading === c.id ? "animate-spin" : ""} />
                    Sync Now
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync log */}
      <div>
        <h3 className="text-sm font-semibold text-emerald-200 mb-3">Recent Sync Activity</h3>
        {syncLogs.length === 0 ? (
          <p className="text-sm text-emerald-500">No sync activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-panelborder">
            <table className="w-full text-xs">
              <thead className="border-b border-panelborder bg-zinc-900/60">
                <tr>
                  {["", "Started", "Type", "Status", "Found", "Processed", "Created", "Errors", "Account"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-emerald-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {syncLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-3 py-2"><StatusIcon status={l.status} /></td>
                    <td className="px-3 py-2 text-emerald-400 whitespace-nowrap">{fmtDate(l.started_at)}</td>
                    <td className="px-3 py-2 text-emerald-500">{l.sync_type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <span className={l.status === "completed" ? "text-positive" : l.status === "failed" ? "text-danger" : "text-yellow-400"}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-500">{l.emails_found}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-500">{l.emails_processed}</td>
                    <td className="px-3 py-2 tabular-nums text-positive">{l.records_created}</td>
                    <td className="px-3 py-2 tabular-nums text-danger">{l.errors_found}</td>
                    <td className="px-3 py-2 text-emerald-600">{l.gmail_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
