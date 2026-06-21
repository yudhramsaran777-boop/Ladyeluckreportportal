"use client";

// ============================================================================
// Lady E Luck Portal — AddPlayerPanel
// Phase 4: Slide-in drawer for mapping an unmatched payment transaction
// to a player.
//
// Desktop: fixed right-side drawer (w-96)
// Mobile:  full-width bottom-attached panel
//
// Behaviors:
//   - Opens when the parent passes selectedTransaction != null
//   - Closes with X button or Escape key
//   - Warns before closing when form has unsaved changes
//   - Disabled submit while saving
//   - Shows loading / success / error states
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { addPlayerMapping, editPlayerMapping } from "@/app/employee/payment-info/payment-actions";
import type {
  AddPlayerPanelTransaction,
  PlayerMappingResult,
} from "@/lib/payment/payment-types";
import { GAMES } from "@/lib/constants";
import { formatCurrency } from "@/lib/calculations";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AddPlayerPanelProps {
  /** The transaction to map, or null when the panel is closed. */
  transaction: AddPlayerPanelTransaction | null;
  /** Called when the panel should close. */
  onClose: () => void;
  /**
   * Called after a successful save with the updated transaction fields.
   * Parent should patch its local transaction list.
   */
  onSaved: (result: PlayerMappingResult & { transactionId: string }) => void;
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
// Read-only field row
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-28 shrink-0 text-emerald-200/50">{label}</span>
      <span className="text-emerald-100 break-all">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddPlayerPanel({ transaction, onClose, onSaved }: AddPlayerPanelProps) {
  const isEditing = Boolean(transaction?.player_mapping_id);

  const [playerName, setPlayerName]   = useState("");
  const [facebookName, setFacebookName] = useState("");
  const [gameUsername, setGameUsername] = useState("");
  const [primaryGame, setPrimaryGame]   = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      // If editing an existing mapping, could pre-fill from transaction
      setPlayerName(transaction.player_name ?? "");
      setFacebookName("");
      setGameUsername(transaction.game_username ?? "");
      setPrimaryGame("");
      setInternalNote("");
      setSaved(false);
      setError(null);
      // Focus first input after the panel opens
      setTimeout(() => firstInputRef.current?.focus(), 150);
    }
  }, [transaction]);

  const isDirty =
    playerName.trim() !== "" ||
    facebookName.trim() !== "" ||
    gameUsername.trim() !== "" ||
    primaryGame !== "" ||
    internalNote.trim() !== "";

  const handleClose = useCallback(() => {
    if (saving) return;
    if (isDirty && !saved) {
      if (!window.confirm("You have unsaved changes. Close anyway?")) return;
    }
    onClose();
  }, [saving, isDirty, saved, onClose]);

  // Escape key closes the panel
  useEffect(() => {
    if (!transaction) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [transaction, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    if (!playerName.trim()) {
      setError("Player name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    let result: PlayerMappingResult;

    if (isEditing && transaction.player_mapping_id) {
      result = await editPlayerMapping({
        mappingId: transaction.player_mapping_id,
        playerName: playerName.trim(),
        facebookName: facebookName.trim() || undefined,
        gameUsername: gameUsername.trim() || undefined,
        primaryGame: primaryGame || undefined,
        internalNote: internalNote.trim() || undefined,
      });
    } else {
      result = await addPlayerMapping({
        transactionId: transaction.id,
        playerName: playerName.trim(),
        facebookName: facebookName.trim() || undefined,
        gameUsername: gameUsername.trim() || undefined,
        primaryGame: primaryGame || undefined,
        internalNote: internalNote.trim() || undefined,
      });
    }

    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save.");
      return;
    }

    setSaved(true);
    onSaved({ ...result, transactionId: transaction.id });

    // Auto-close after brief success feedback
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Don't render if no transaction
  if (!transaction) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Edit Player Mapping" : "Add Player to Transaction"}
        className={clsx(
          "fixed z-50 flex flex-col bg-panel border-l border-panelborder shadow-2xl",
          "transition-transform duration-200",
          // Desktop: right side drawer
          "sm:top-0 sm:right-0 sm:h-full sm:w-96",
          // Mobile: bottom sheet
          "max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-panelborder px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {isEditing ? "Edit Player" : "Add Player"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-1 text-emerald-200/50 hover:bg-emerald-800/40 hover:text-white transition-colors"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Transaction info (read-only) */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200/40">
              Transaction
            </h3>
            <div className="space-y-1.5 rounded-lg border border-panelborder bg-emerald-950/40 p-3">
              <InfoRow label="Provider"     value={transaction.provider} />
              <InfoRow label="Account"      value={transaction.payment_account_name} />
              <InfoRow label="Our Tag"      value={transaction.business_payment_tag} />
              <InfoRow label="Customer Tag" value={transaction.customer_payment_tag} />
              <InfoRow label="Customer"     value={transaction.customer_name} />
              <InfoRow
                label="Amount"
                value={
                  <span className="font-semibold text-white">
                    {formatCurrency(transaction.individual_amount)}
                  </span>
                }
              />
              <InfoRow label="Direction" value={transaction.direction} />
              <InfoRow label="Time"      value={formatDateTime(transaction.occurred_at)} />
              <InfoRow label="Status"    value={transaction.transaction_status} />
            </div>
          </section>

          {/* Player form */}
          <form id="add-player-form" onSubmit={handleSubmit}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200/40">
              Player Details
            </h3>
            <div className="space-y-3">
              {/* Player Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Player Name <span className="text-danger">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={100}
                  placeholder="Full name or nickname"
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>

              {/* Facebook Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Facebook Name
                </label>
                <input
                  type="text"
                  value={facebookName}
                  onChange={(e) => setFacebookName(e.target.value)}
                  maxLength={100}
                  placeholder="Facebook profile name"
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>

              {/* Game Username */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Game Username
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

              {/* Primary Game */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Primary Game
                </label>
                <select
                  value={primaryGame}
                  onChange={(e) => setPrimaryGame(e.target.value)}
                  disabled={saving || saved}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                >
                  <option value="">— Select game —</option>
                  {GAMES.map((g) => (
                    <option key={g.code} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Internal Note */}
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-200/70">
                  Internal Note
                </label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Optional notes (not shown to player)"
                  disabled={saving || saved}
                  className="w-full resize-none rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50 disabled:opacity-50"
                />
              </div>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Success */}
          {saved && (
            <div className="rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-xs text-positive">
              Player saved successfully!
            </div>
          )}
        </div>

        {/* Footer actions */}
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
            form="add-player-form"
            disabled={saving || saved || !playerName.trim()}
            className={clsx(
              "rounded-lg border px-4 py-2 text-xs font-semibold transition-colors",
              saving || saved || !playerName.trim()
                ? "cursor-not-allowed border-emerald-700/40 bg-transparent text-emerald-200/30"
                : "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
            )}
          >
            {saving ? "Saving…" : saved ? "Saved!" : isEditing ? "Save Changes" : "Add Player"}
          </button>
        </div>
      </aside>
    </>
  );
}
