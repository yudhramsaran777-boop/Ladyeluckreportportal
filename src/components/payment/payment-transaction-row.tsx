"use client";

// ============================================================================
// Lady E Luck Portal - PaymentTransactionRow
// Phase 3: Renders a single EmployeePaymentTransaction.
//
// Action buttons (Add Player, Recharge Player) accept optional callback props.
// In Phase 3 these callbacks are undefined - buttons are shown as disabled
// placeholders so the layout is finalized before Phase 4 / 5 wire them up.
// ============================================================================

import clsx from "clsx";
import type { EmployeePaymentTransaction } from "@/lib/payment/payment-types";
import { formatCurrency } from "@/lib/calculations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

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
// Provider badge
// ---------------------------------------------------------------------------

function ProviderBadge({ provider }: { provider: "CashApp" | "Chime" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        provider === "CashApp"
          ? "border-positive/30 bg-positive/10 text-positive"
          : "border-blue-400/30 bg-blue-500/10 text-blue-300"
      )}
    >
      {provider}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Direction badge
// ---------------------------------------------------------------------------

function DirectionBadge({ direction }: { direction: "received" | "sent" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        direction === "received"
          ? "border-positive/30 bg-positive/10 text-positive"
          : "border-warning/30 bg-warning/10 text-warning"
      )}
    >
      {direction === "received" ? "Received" : "Sent"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Player match status indicator
// ---------------------------------------------------------------------------

function MatchDot({ status }: { status: EmployeePaymentTransaction["player_match_status"] }) {
  const styles: Record<string, string> = {
    matched: "bg-positive",
    unmatched: "bg-emerald-200/30",
    needs_review: "bg-warning",
    conflicting: "bg-danger",
    blocked: "bg-danger",
  };
  return (
    <span
      className={clsx(
        "inline-block h-2 w-2 rounded-full",
        styles[status] ?? "bg-emerald-200/30"
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Recharge status label
// ---------------------------------------------------------------------------

function RechargeLabel({
  status,
}: {
  status: EmployeePaymentTransaction["recharge_status"];
}) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    completed_with_bonus: { label: "Bonus given", cls: "text-positive" },
    completed_no_bonus:   { label: "Recharged",   cls: "text-positive" },
    under_recharged:      { label: "Undercharged", cls: "text-warning" },
    needs_review:         { label: "Needs review", cls: "text-warning" },
    voided:               { label: "Voided",        cls: "text-danger" },
  };
  const entry = map[status] ?? { label: status, cls: "text-emerald-200/50" };
  return <span className={clsx("text-xs font-medium", entry.cls)}>{entry.label}</span>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentTransactionRowProps {
  transaction: EmployeePaymentTransaction;
  /** Show full date+time instead of time-only (used in full table vs preview). */
  showDate?: boolean;
  /** Phase 4: called when employee clicks "Add Player". Undefined = disabled. */
  onAddPlayer?: (txn: EmployeePaymentTransaction) => void;
  /** Phase 5: called when employee clicks "Recharge Player". Undefined = disabled. */
  onRecharge?: (txn: EmployeePaymentTransaction) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentTransactionRow({
  transaction: txn,
  showDate = false,
  onAddPlayer,
  onRecharge,
}: PaymentTransactionRowProps) {
  const t = txn;

  return (
    <div className="flex flex-col gap-1.5 border-b border-panelborder px-4 py-3 last:border-b-0 hover:bg-emerald-950/40">
      {/* Row 1: time · provider · direction · amount */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-[80px] shrink-0 text-xs text-emerald-200/50">
          {showDate ? formatDateTime(t.occurred_at) : formatTime(t.occurred_at)}
        </span>
        <ProviderBadge provider={t.provider} />
        <DirectionBadge direction={t.direction} />
        <span className="ml-auto text-base font-bold text-white">
          {formatCurrency(t.individual_amount)}
        </span>
      </div>

      {/* Row 2: account name · business tag · customer tag */}
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-emerald-100/70">
        <span className="font-medium text-emerald-100">{t.payment_account_name}</span>
        {t.business_payment_tag && (
          <>
            <span className="text-emerald-200/30">·</span>
            <span>{t.business_payment_tag}</span>
          </>
        )}
        {t.customer_payment_tag && (
          <>
            <span className="text-emerald-200/30">→</span>
            <span className="font-mono">{t.customer_payment_tag}</span>
          </>
        )}
      </div>

      {/* Row 3: player info · match status · recharge status */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <MatchDot status={t.player_match_status} />
        {t.player_name ? (
          <span className="text-emerald-100">{t.player_name}</span>
        ) : t.customer_name ? (
          <span className="text-emerald-200/50 italic">{t.customer_name}</span>
        ) : (
          <span className="text-emerald-200/30 italic">Unmatched</span>
        )}
        {t.game_username && (
          <>
            <span className="text-emerald-200/30">·</span>
            <span className="text-emerald-200/60">{t.game_username}</span>
          </>
        )}
        {t.recharge_status && (
          <>
            <span className="text-emerald-200/30">·</span>
            <RechargeLabel status={t.recharge_status} />
          </>
        )}
        {t.recharge_status === "completed_with_bonus" && t.specific_recharge_bonus !== null && (
          <span className="text-positive/70 text-xs">
            (+{formatCurrency(t.specific_recharge_bonus)} bonus)
          </span>
        )}
        {t.recharge_status === "under_recharged" && t.specific_missing_recharge !== null && (
          <span className="text-warning/70 text-xs">
            ({formatCurrency(t.specific_missing_recharge)} missing)
          </span>
        )}
      </div>

      {/* Row 4: action buttons (Phase 4 / 5 will wire these up) */}
      {(t.can_add_player || t.can_recharge) && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {t.can_add_player && (
            <button
              type="button"
              onClick={() => onAddPlayer?.(t)}
              disabled={!onAddPlayer}
              className={clsx(
                "rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                onAddPlayer
                  ? "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
                  : "cursor-not-allowed border-emerald-700/40 bg-transparent text-emerald-200/30"
              )}
            >
              Add Player
            </button>
          )}
          {t.can_recharge && (
            <button
              type="button"
              onClick={() => onRecharge?.(t)}
              disabled={!onRecharge}
              className={clsx(
                "rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                onRecharge
                  ? "border-positive/40 bg-positive/10 text-positive hover:bg-positive/20"
                  : "cursor-not-allowed border-emerald-700/40 bg-transparent text-emerald-200/30"
              )}
            >
              Recharge Player
            </button>
          )}
        </div>
      )}
    </div>
  );
}
