"use client";

// ============================================================================
// Lady E Luck Portal — PlayerMappingReview (Manager)
// Phase 4: Displays all player_payment_tags for the manager's shop.
// Actions: Verify, Mark Needs Review, Block, Deactivate, Edit (correct)
//
// Fetches from the server via the manager actions.
// Renders server-fetched initial data for SSR, then client-mutates after actions.
// ============================================================================

import { useState, useTransition } from "react";
import clsx from "clsx";
import {
  verifyPlayerMapping,
  markPlayerMappingNeedsReview,
  blockPlayerMapping,
  deactivatePlayerMapping,
  correctPlayerMapping,
} from "@/app/manager/payment-accounts/manager-actions";
import type { ManagerPlayerMappingRow, EditPlayerMappingInput } from "@/lib/payment/payment-types";
import { GAMES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    employee_added:   { label: "Pending Review",  cls: "border-warning/30 bg-warning/10 text-warning" },
    manager_verified: { label: "Verified",         cls: "border-positive/30 bg-positive/10 text-positive" },
    needs_review:     { label: "Needs Review",     cls: "border-warning/30 bg-warning/10 text-warning" },
    conflicting_match:{ label: "Conflicting",      cls: "border-danger/30 bg-danger/10 text-danger" },
    blocked:          { label: "Blocked",          cls: "border-danger/30 bg-danger/10 text-danger" },
    inactive:         { label: "Inactive",         cls: "border-emerald-700/30 bg-emerald-950/30 text-emerald-200/40" },
    unmatched:        { label: "Unmatched",        cls: "border-emerald-700/30 bg-emerald-950/30 text-emerald-200/40" },
  };
  const entry = map[status] ?? { label: status, cls: "border-emerald-700/30 text-emerald-200/50" };
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", entry.cls)}>
      {entry.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Reason prompt modal (for block / needs-review)
// ---------------------------------------------------------------------------

function ReasonModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-panelborder bg-panel p-5 space-y-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Enter reason (required)..."
          className="w-full resize-none rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/50"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-xs font-semibold text-emerald-200/70 hover:bg-emerald-800/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-40 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit modal (for correction)
// ---------------------------------------------------------------------------

function EditModal({
  mapping,
  onSave,
  onCancel,
}: {
  mapping: ManagerPlayerMappingRow;
  onSave: (data: EditPlayerMappingInput) => void;
  onCancel: () => void;
}) {
  const [playerName, setPlayerName]   = useState(mapping.player_name ?? "");
  const [facebookName, setFacebookName] = useState(mapping.facebook_name ?? "");
  const [gameUsername, setGameUsername] = useState(mapping.game_username ?? "");
  const [primaryGame, setPrimaryGame]   = useState(mapping.primary_game ?? "");
  const [internalNote, setInternalNote] = useState(mapping.internal_note ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onSave({
      mappingId: mapping.id,
      playerName: playerName.trim(),
      facebookName: facebookName.trim() || undefined,
      gameUsername: gameUsername.trim() || undefined,
      primaryGame: primaryGame || undefined,
      internalNote: internalNote.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-panelborder bg-panel p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-white">Correct Player Mapping</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-200/70">
              Player Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={100}
              autoFocus
              className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-200/70">Facebook Name</label>
            <input
              type="text"
              value={facebookName}
              onChange={(e) => setFacebookName(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-200/70">Game Username</label>
            <input
              type="text"
              value={gameUsername}
              onChange={(e) => setGameUsername(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-200/70">Primary Game</label>
            <select
              value={primaryGame}
              onChange={(e) => setPrimaryGame(e.target.value)}
              className="w-full rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50"
            >
              <option value="">— Select game —</option>
              {GAMES.map((g) => (
                <option key={g.code} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-emerald-200/70">Internal Note</label>
            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-lg border border-panelborder bg-emerald-950 px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-xs font-semibold text-emerald-200/70 hover:bg-emerald-800/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!playerName.trim()}
              className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-40 transition-colors"
            >
              Save &amp; Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PlayerMappingReviewProps {
  initialMappings: ManagerPlayerMappingRow[];
}

export function PlayerMappingReview({ initialMappings }: PlayerMappingReviewProps) {
  const [mappings, setMappings] = useState<ManagerPlayerMappingRow[]>(initialMappings);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modal state
  type ModalState =
    | { type: "reason"; action: "block" | "needs_review"; mappingId: string }
    | { type: "edit"; mapping: ManagerPlayerMappingRow }
    | null;
  const [modal, setModal] = useState<ModalState>(null);

  function patchMapping(id: string, patch: Partial<ManagerPlayerMappingRow>) {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

  function handleVerify(mappingId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await verifyPlayerMapping(mappingId);
      if (!result.success) {
        setActionError(result.error ?? "Failed to verify.");
        return;
      }
      patchMapping(mappingId, { verification_status: "manager_verified" });
    });
  }

  function handleNeedsReview(mappingId: string, reason: string) {
    setModal(null);
    setActionError(null);
    startTransition(async () => {
      const result = await markPlayerMappingNeedsReview(mappingId, reason);
      if (!result.success) {
        setActionError(result.error ?? "Failed.");
        return;
      }
      patchMapping(mappingId, {
        verification_status: "needs_review",
        manager_review_reason: reason,
      });
    });
  }

  function handleBlock(mappingId: string, reason: string) {
    setModal(null);
    setActionError(null);
    startTransition(async () => {
      const result = await blockPlayerMapping(mappingId, reason);
      if (!result.success) {
        setActionError(result.error ?? "Failed.");
        return;
      }
      patchMapping(mappingId, {
        verification_status: "blocked",
        manager_review_reason: reason,
      });
    });
  }

  function handleDeactivate(mappingId: string) {
    if (!window.confirm("Deactivate this mapping? It can be recreated later.")) return;
    setActionError(null);
    startTransition(async () => {
      const result = await deactivatePlayerMapping(mappingId);
      if (!result.success) {
        setActionError(result.error ?? "Failed.");
        return;
      }
      patchMapping(mappingId, { status: "inactive", verification_status: "inactive" });
    });
  }

  function handleCorrect(data: EditPlayerMappingInput) {
    setModal(null);
    setActionError(null);
    startTransition(async () => {
      const result = await correctPlayerMapping(data);
      if (!result.success) {
        setActionError(result.error ?? "Failed.");
        return;
      }
      patchMapping(data.mappingId, {
        player_name: data.playerName,
        facebook_name: data.facebookName ?? null,
        game_username: data.gameUsername ?? null,
        primary_game: data.primaryGame ?? null,
        internal_note: data.internalNote ?? null,
        verification_status: "manager_verified",
      });
    });
  }

  if (mappings.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-emerald-200/40">
        No player mappings yet. Employees create mappings when they add a player to a transaction.
      </div>
    );
  }

  return (
    <>
      {/* Modals */}
      {modal?.type === "reason" && (
        <ReasonModal
          title={
            modal.action === "block"
              ? "Block this mapping — enter reason"
              : "Flag for review — enter reason"
          }
          onConfirm={(reason) =>
            modal.action === "block"
              ? handleBlock(modal.mappingId, reason)
              : handleNeedsReview(modal.mappingId, reason)
          }
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <EditModal
          mapping={modal.mapping}
          onSave={handleCorrect}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Error bar */}
      {actionError && (
        <div className="mx-4 mb-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-panelborder text-emerald-200/40 uppercase tracking-wide">
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Tag</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Facebook</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Game</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Added by</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panelborder">
            {mappings.map((m) => (
              <tr
                key={m.id}
                className={clsx(
                  "hover:bg-emerald-950/40 transition-colors",
                  m.status === "inactive" && "opacity-50"
                )}
              >
                <td className="px-3 py-2 text-emerald-100">{m.provider}</td>
                <td className="px-3 py-2 font-mono text-emerald-100/70">
                  <div>{m.payment_tag}</div>
                  <div className="text-emerald-200/30 text-[10px]">{m.normalized_payment_tag}</div>
                </td>
                <td className="px-3 py-2 text-emerald-100 font-medium">{m.player_name ?? "—"}</td>
                <td className="px-3 py-2 text-emerald-100/70">{m.facebook_name ?? "—"}</td>
                <td className="px-3 py-2 text-emerald-100/70">{m.game_username ?? "—"}</td>
                <td className="px-3 py-2 text-emerald-100/70">{m.primary_game ?? "—"}</td>
                <td className="px-3 py-2">
                  <VerificationBadge status={m.verification_status} />
                  {m.manager_review_reason && (
                    <div className="mt-1 text-[10px] text-emerald-200/40 italic max-w-[160px] truncate">
                      {m.manager_review_reason}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-emerald-200/40">{m.added_by_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {/* Verify */}
                    {m.verification_status !== "manager_verified" &&
                      m.verification_status !== "blocked" &&
                      m.status === "active" && (
                        <button
                          type="button"
                          onClick={() => handleVerify(m.id)}
                          disabled={isPending}
                          className="rounded border border-positive/30 bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive hover:bg-positive/20 disabled:opacity-40 transition-colors"
                        >
                          Verify
                        </button>
                      )}

                    {/* Edit / Correct */}
                    {m.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "edit", mapping: m })}
                        disabled={isPending}
                        className="rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold hover:bg-gold/20 disabled:opacity-40 transition-colors"
                      >
                        Edit
                      </button>
                    )}

                    {/* Needs Review */}
                    {m.verification_status !== "needs_review" &&
                      m.verification_status !== "blocked" &&
                      m.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setModal({ type: "reason", action: "needs_review", mappingId: m.id })}
                          disabled={isPending}
                          className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning hover:bg-warning/20 disabled:opacity-40 transition-colors"
                        >
                          Flag
                        </button>
                      )}

                    {/* Block */}
                    {m.verification_status !== "blocked" && m.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "reason", action: "block", mappingId: m.id })}
                        disabled={isPending}
                        className="rounded border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger/20 disabled:opacity-40 transition-colors"
                      >
                        Block
                      </button>
                    )}

                    {/* Deactivate */}
                    {m.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(m.id)}
                        disabled={isPending}
                        className="rounded border border-emerald-700/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200/50 hover:bg-emerald-800/30 disabled:opacity-40 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
