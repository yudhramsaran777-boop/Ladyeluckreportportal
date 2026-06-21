"use client";

// ============================================================================
// Lady E Luck Portal — RechargePlayerDialog
// Phase 5: Modal/bottom-sheet for recording a game coin recharge.
//
// Desktop: centered modal overlay
// Mobile:  full-width bottom sheet
//
// Behaviors:
//   - Opens when parent passes transaction != null
//   - Closes with X button, Escape key, or backdrop click
//   - Warns before closing when form has unsaved changes
//   - Submit disabled while saving or after success
//   - Live preview of bonus_given / missing_recharge / status
//   - Cash amount is read-only — never editable
//   - Server recalculates independently; client preview is UI-only
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { createRecharge } from "@/app/employee/payment-info/payment-actions";
import { calculateRecharge } from "@/lib/payment/recharge-calculator";
import { formatCurrency } from "@/lib/calculations";
import type {
  RechargeDialogTransaction,
  RechargeResult,
  ActiveGame,
} from "@/lib/payment/payment-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RechargePlayerDialogProps {
  /** Transaction to recharge, or null when dialog is closed. */
  transaction: RechargeDialogTransaction | null;
  /** Active games loaded from the server for the dropdown. */
  games: ActiveGame[];
  /** Called when the dialog should close. */
  onClose: () => void;
  /**
   * Called after a successful recharge.
   * Parent should patch its local transaction list with the result.
   */
  onSaved: (result: RechargeResult & { transactionId: string }) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
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
// Read-only info row
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-28 shrink-0 text-emerald-200/50">{label}</span>
      <span className="text-emerald-100 break-all">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recharge status label
// ---------------------------------------------------------------------------

function RechargeStatusBadge({
  status,
}: {
  status: "completed_with_bonus" | "completed_no_bonus" | "under_recharged" | null;
}) {
  if (!status) return null;
  const map = {
    completed_with_bonus: { label: "Bonus Given", cls: "border-positive/30 bg-positive/10 text-positive" },
    completed_no_bonus:   { label: "Exact Recharge", cls: "border-positive/30 bg-positive/10 text-positive" },
    under_recharged:      { label: "Under-Recharged", cls: "border-warning/30 bg-warning/10 text-warning" },
  };
  const entry = map[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        entry.cls
      )}
    >
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RechargePlayerDialog({
  transaction,
  games,
  onClose,
  onSaved,
}: RechargePlayerDialogProps) {
  const [gameId, setGameId]           = useState("");
  const [gameUsername, setGameUsername] = useState("");
  const [coinsStr, setCoinsStr]       = useState("");
  const [notes, setNotes]             = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Reset form when a new transaction is passed in
  useEffect(() => {
    if (transaction) {
      setGameId("");
      setGameUsername(transaction.game_username ?? "");
      setCoinsStr("");
      setNotes("");
      setSaved(false);
      setError(null);
    }
  }, [transaction]);

  const isDirty =
    gameId !== "" ||
    gameUsername.trim() !== (transaction?.game_username ?? "") ||
    coinsStr !== "" ||
    notes.trim() !== "";

  const handleClose = useCallback(() => {
    if (saving) return;
    if (isDirty && !saved) {
      if (!window.confirm("You have unsaved changes. Close anyway?")) return;
    }
    onClose();
  }, [saving, isDirty, saved, onClose]);

  // Escape key
  useEffect(() => {
    if (!transaction) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [transaction, handleClose]);

  // ---- Live preview -------------------------------------------------------
  const cashReceived = transaction ? Number(transaction.individual_amount) : 0;
  const coinsNum     = parseFloat(coinsStr);
  const coinsValid   = coinsStr !== "" && !isNaN(coinsNum) && isFinite(coinsNum) && coinsNum >= 0;

  let previewBonus: number | null    = null;
  let previewMissing: number | null  = null;
  let previewStatus: "completed_with_bonus" | "completed_no_bonus" | "under_recharged" | null = null;

  if (coinsValid) {
    try {
      const calc = calculateRecharge(cashReceived, coinsNum);
      previewBonus   = calc.bonus_given;
      previewMissing = calc.missing_recharge;
      if (calc.db_recharge_status === "bonus_given")       previewStatus = "completed_with_bonus";
      else if (calc.db_recharge_status === "exact")         previewStatus = "completed_no_bonus";
      else if (calc.db_recharge_status === "missing_recharge") previewStatus = "under_recharged";
    } catch {
      // Invalid input — preview stays null
    }
  }

  // ---- Submit -------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    // Client-side validation
    if (!gameId) {
      setError("Please select a game.");
      return;
    }
    if (!gameUsername.trim()) {
      setError("Game username is required.");
      return;
    }
    if (coinsStr === "" || isNaN(coinsNum) || !isFinite(coinsNum)) {
      setError("Please enter a valid number of coins recharged.");
      return;
    }
    if (coinsNum < 0) {
      setError("Coins recharged cannot be negative.");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createRecharge({
      transactionId: transaction.id,
      gameId,
      gameUsername: gameUsername.trim(),
      coinsRecharged: coinsNum,
      notes: notes.trim() || undefined,
    });

    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save recharge.");
      return;
    }

    setSaved(true);
    onSaved({ ...result, transactionId: transaction.id });

    // Auto-close after brief success display
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Don't render if no transaction
  if (!transaction) return null;

  const canSubmit = !saving && !saved && gameId !== "" && gameUsername.trim() !== "" && coinsValid;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recharge Player"
        className={clsx(
          "fixed z-50 flex flex-col bg-panel border border-panelborder shadow-2xl",
          // Desktop: centered modal
          "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-2xl sm:w-full sm:max-w-lg sm:max-h-[90vh]",
          // Mobile: bottom sheet
          "max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-h-[92vh]",
          "max-sm:rounded-t-2xl max-sm:rounded-b-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-panelborder px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-white">Recharge Player</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-1 text-emerald-200/50 hover:bg-emerald-800/40 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Transaction info (read-only) */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200/40">
              Payment
            </h3>
            <div className="space-y-1.5 rounded-lg border border-panelborder bg-emerald-950/40 p-3">
              <InfoRow label="Provider"     value={transaction.provider} />
              <InfoRow label="Account"      value={transaction.payment_account_name} />
              <InfoRow label="Our Tag"      value={transaction.business_payment_tag} />
              <InfoRow label="Customer Tag" value={transaction.customer_payment_tag} />
              <InfoRow label="Customer"     value={transaction.customer_name} />
              <InfoRow label="Player"       value={transaction.player_name} />
              <InfoRow label="Game User"    value={transaction.game_username} />
              <InfoRow
                label="Cash Amount"
                value={
                  <span className="font-bold text-white text-sm">
                    {formatCurrency(transaction.individual_amount)}
                  </span>
                }
              />
              <InfoRow label="Direction"    value={transaction.direction} />
              <InfoRow label="Time"         value={formatDateTime(transaction.occurred_at)} />
              <InfoRow label="Status"       value={transaction.transaction_status} />
            </div>
          </section>

          {/* Recharge form */}
          <form id="recharge-form" onSubmit={handleSubmit}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200/40">
              Recharge Details
            </h3>
            <div className="space-y-3">

              {/* Game dropdown */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Game <span className="text-danger">*</span>
                </label>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                >
                  <option value="">— Select game —</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.game_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Game Username */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Game Username <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={gameUsername}
                  onChange={(e) => setGameUsername(e.target.value)}
                  maxLength={100}
                  placeholder="In-game username"
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>

              {/* Coins Recharged */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Coins Recharged <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  value={coinsStr}
                  onChange={(e) => setCoinsStr(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Note (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Optional notes"
                  disabled={saving || saved}
                  className="w-full resize-none rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>
            </div>
          </form>

          {/* Live Preview */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200/40">
              Preview
            </h3>
            <div className="rounded-lg border border-panelborder bg-emerald-950/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-emerald-200/50">Cash Received</span>
                <span className="font-bold text-white">{formatCurrency(cashReceived)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-emerald-200/50">Coins Recharged</span>
                <span className="text-emerald-100">
                  {coinsValid ? formatCurrency(coinsNum) : <span className="text-emerald-200/30">—</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-emerald-200/50">Bonus Given</span>
                <span className={clsx(previewBonus !== null && previewBonus > 0 ? "text-positive font-semibold" : "text-emerald-200/40")}>
                  {previewBonus !== null ? formatCurrency(previewBonus) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-emerald-200/50">Missing</span>
                <span className={clsx(previewMissing !== null && previewMissing > 0 ? "text-warning font-semibold" : "text-emerald-200/40")}>
                  {previewMissing !== null ? formatCurrency(previewMissing) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-emerald-200/50">Status</span>
                {previewStatus ? (
                  <RechargeStatusBadge status={previewStatus} />
                ) : (
                  <span className="text-emerald-200/30">—</span>
                )}
              </div>
            </div>
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Success */}
          {saved && (
            <div className="rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-xs text-positive">
              Recharge saved successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-panelborder px-4 py-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg border border-emerald-700/50 bg-transparent px-4 py-2 text-xs font-semibold text-emerald-200/70 hover:bg-emerald-800/30 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recharge-form"
            disabled={!canSubmit}
            className={clsx(
              "rounded-lg border px-4 py-2 text-xs font-semibold transition-colors",
              canSubmit
                ? "border-positive/40 bg-positive/10 text-positive hover:bg-positive/20"
                : "cursor-not-allowed border-emerald-700/40 bg-transparent text-emerald-200/30"
            )}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save Recharge"}
          </button>
        </div>
      </div>
    </>
  );
}
