"use client";

// ============================================================================
// Lady E Luck Portal — RechargeReviewSection
// Phase 5: Manager view of under-recharged and recent recharge records.
//
// - Shows all non-voided recharges for the manager's shop (SSR initial data
//   passed from the parent Server Component).
// - Manager can void incorrect recharges with a reason.
// - Voided recharges remain visible (audit history).
// - No aggregate totals are shown (Phase 6+).
// ============================================================================

import { useState, useCallback } from "react";
import clsx from "clsx";
import { voidRecharge } from "@/app/manager/payment-accounts/manager-actions";
import { formatCurrency } from "@/lib/calculations";
import type { ManagerRechargeRow, VoidRechargeResult } from "@/lib/payment/payment-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ManagerRechargeRow["recharge_status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed_with_bonus: {
      label: "Bonus Given",
      cls: "border-positive/30 bg-positive/10 text-positive",
    },
    completed_no_bonus: {
      label: "Exact",
      cls: "border-positive/30 bg-positive/10 text-positive",
    },
    under_recharged: {
      label: "Under-Recharged",
      cls: "border-warning/30 bg-warning/10 text-warning",
    },
    needs_review: {
      label: "Needs Review",
      cls: "border-warning/30 bg-warning/10 text-warning",
    },
    voided: {
      label: "Voided",
      cls: "border-danger/30 bg-danger/10 text-danger",
    },
  };
  const entry = map[status] ?? { label: status, cls: "border-panelborder text-emerald-200/50" };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        entry.cls
      )}
    >
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Void dialog (inline)
// ---------------------------------------------------------------------------

function VoidDialog({
  rechargeId,
  onConfirm,
  onCancel,
  saving,
}: {
  rechargeId: string;
  onConfirm: (id: string, reason: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-2">
      <p className="text-xs text-danger font-medium">Void this recharge?</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Reason for voiding (required)"
        disabled={saving}
        className="w-full resize-none rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-xs text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-danger/50 disabled:opacity-50"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-emerald-700/50 px-3 py-1 text-xs font-semibold text-emerald-200/70 hover:bg-emerald-800/30 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => reason.trim() && onConfirm(rechargeId, reason.trim())}
          disabled={saving || !reason.trim()}
          className={clsx(
            "rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
            saving || !reason.trim()
              ? "cursor-not-allowed border-emerald-700/40 text-emerald-200/30"
              : "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
          )}
        >
          {saving ? "Voiding…" : "Confirm Void"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single recharge row
// ---------------------------------------------------------------------------

function RechargeRow({
  row,
  onVoid,
}: {
  row: ManagerRechargeRow;
  onVoid: (id: string, reason: string) => Promise<void>;
}) {
  const [showVoid, setShowVoid] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const isVoided = Boolean(row.voided_at);
  const isUnder  = row.recharge_status === "under_recharged";

  const handleVoidConfirm = async (id: string, reason: string) => {
    setSaving(true);
    setError(null);
    await onVoid(id, reason);
    setSaving(false);
    setShowVoid(false);
  };

  return (
    <div
      className={clsx(
        "border-b border-panelborder px-4 py-3 last:border-b-0",
        isVoided ? "opacity-50" : isUnder ? "hover:bg-warning/5" : "hover:bg-emerald-950/40"
      )}
    >
      {/* Row header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-emerald-200/50 min-w-[140px] shrink-0">
          {formatDateTime(row.transaction_occurred_at)}
        </span>
        <StatusBadge status={row.recharge_status} />
        <span className="ml-auto font-bold text-white text-sm">
          {formatCurrency(row.cash_received)} received
        </span>
      </div>

      {/* Details */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-emerald-200/60">
        {row.player_name && (
          <span className="text-emerald-100 font-medium">{row.player_name}</span>
        )}
        {row.game_name && (
          <span>{row.game_name}</span>
        )}
        {row.game_username && (
          <span className="font-mono">{row.game_username}</span>
        )}
        <span>
          <span className="text-emerald-200/40">Coins: </span>
          <span className="text-emerald-100">{formatCurrency(row.coins_recharged)}</span>
        </span>
        {row.bonus_given > 0 && (
          <span className="text-positive">
            +{formatCurrency(row.bonus_given)} bonus
          </span>
        )}
        {row.missing_recharge > 0 && (
          <span className="text-warning">
            {formatCurrency(row.missing_recharge)} missing
          </span>
        )}
        {row.employee_name && (
          <span className="text-emerald-200/40">by {row.employee_name}</span>
        )}
      </div>

      {/* Void info */}
      {isVoided && row.voided_at && (
        <div className="mt-1 text-xs text-danger/70">
          Voided {formatDateTime(row.voided_at)}
          {row.voided_by_name ? ` by ${row.voided_by_name}` : ""}
        </div>
      )}

      {/* Error from void attempt */}
      {error && (
        <div className="mt-1 text-xs text-danger">{error}</div>
      )}

      {/* Void action */}
      {!isVoided && (
        <>
          {!showVoid && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => { setShowVoid(true); setError(null); }}
                className="rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-1 text-[10px] font-semibold text-danger hover:bg-danger/15 transition-colors"
              >
                Void Recharge
              </button>
            </div>
          )}
          {showVoid && (
            <VoidDialog
              rechargeId={row.id}
              onConfirm={async (id, reason) => {
                await handleVoidConfirm(id, reason);
              }}
              onCancel={() => setShowVoid(false)}
              saving={saving}
            />
          )}
        </>
      )}

      {success && (
        <div className="mt-1 text-xs text-positive">Recharge voided successfully.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export interface RechargeReviewSectionProps {
  initialRecharges: ManagerRechargeRow[];
}

export function RechargeReviewSection({ initialRecharges }: RechargeReviewSectionProps) {
  const [recharges, setRecharges] = useState<ManagerRechargeRow[]>(initialRecharges);
  const [filter, setFilter]       = useState<"all" | "under_recharged" | "voided">("all");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleVoid = useCallback(
    async (rechargeId: string, reason: string) => {
      setGlobalError(null);
      const result: VoidRechargeResult = await voidRecharge({ rechargeId, reason });
      if (!result.success) {
        setGlobalError(result.error ?? "Failed to void recharge.");
        return;
      }
      // Patch the local list
      setRecharges((prev) =>
        prev.map((r) =>
          r.id === rechargeId
            ? { ...r, recharge_status: "voided", voided_at: new Date().toISOString() }
            : r
        )
      );
    },
    []
  );

  const visible = recharges.filter((r) => {
    if (filter === "all") return true;
    if (filter === "under_recharged") return r.recharge_status === "under_recharged";
    if (filter === "voided") return Boolean(r.voided_at);
    return true;
  });

  const underCount = recharges.filter(
    (r) => r.recharge_status === "under_recharged" && !r.voided_at
  ).length;

  return (
    <div className="card-panel overflow-hidden">
      {/* Header */}
      <div className="border-b border-panelborder px-4 py-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-white">Recharge Review</h2>
        {underCount > 0 && (
          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            {underCount} under-recharged
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          {(["all", "under_recharged", "voided"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                filter === f
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-panelborder text-emerald-200/50 hover:text-emerald-100"
              )}
            >
              {f === "all" ? "All" : f === "under_recharged" ? "Under-Recharged" : "Voided"}
            </button>
          ))}
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="mx-4 mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {globalError}
        </div>
      )}

      {/* Rows */}
      {visible.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-emerald-200/40">
          {filter === "all" ? "No recharges yet." : `No ${filter.replace("_", "-")} recharges.`}
        </div>
      ) : (
        <div>
          {visible.map((row) => (
            <RechargeRow key={row.id} row={row} onVoid={handleVoid} />
          ))}
        </div>
      )}
    </div>
  );
}
