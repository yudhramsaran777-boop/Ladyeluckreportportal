"use client";

// ============================================================================
// Lady E Luck Portal - PaymentActivityClient
// Phase 5: Adds RechargePlayerDialog wiring. Maintains all Phase 3/4
// filter/pagination/add-player behavior.
//
// Receives initial SSR data from PaymentActivitySection (Server Component).
// Subsequent filter changes and pagination call /api/payment/transactions.
// The API route derives shop_id from the authenticated session.
// ============================================================================

import { useState, useCallback, useTransition, useEffect } from "react";
import type {
  EmployeePaymentTransaction,
  AddPlayerPanelTransaction,
  PlayerMappingResult,
  RechargeDialogTransaction,
  RechargeResult,
  ActiveGame,
} from "@/lib/payment/payment-types";
import { PaymentTransactionTable } from "@/components/payment/payment-transaction-table";
import { AddPlayerPanel } from "@/components/payment/add-player-panel";
import { RechargePlayerDialog } from "@/components/payment/recharge-player-dialog";
import { usePaymentRealtime } from "@/hooks/use-payment-realtime";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface FilterState {
  provider: "" | "CashApp" | "Chime";
  direction: "" | "received" | "sent";
  playerMatch: "" | "matched" | "unmatched" | "needs_review";
  recharged: "" | "true" | "false";
  searchTag: string;
  searchPlayer: string;
  dateStart: string;
  dateEnd: string;
}

const DEFAULT_FILTERS: FilterState = {
  provider: "",
  direction: "",
  playerMatch: "",
  recharged: "",
  searchTag: "",
  searchPlayer: "",
  dateStart: "",
  dateEnd: "",
};

// ---------------------------------------------------------------------------
// Build URL params from filter state
// ---------------------------------------------------------------------------

function buildParams(filters: FilterState, cursor?: string | null, limit = 20): URLSearchParams {
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  if (cursor) p.set("cursor", cursor);
  if (filters.provider)    p.set("provider",      filters.provider);
  if (filters.direction)   p.set("direction",      filters.direction);
  if (filters.playerMatch) p.set("player_match",   filters.playerMatch);
  if (filters.recharged)   p.set("recharged",      filters.recharged);
  if (filters.searchTag.trim())    p.set("search_tag",    filters.searchTag.trim());
  if (filters.searchPlayer.trim()) p.set("search_player", filters.searchPlayer.trim());
  if (filters.dateStart)   p.set("date_start",     filters.dateStart);
  if (filters.dateEnd)     p.set("date_end",        filters.dateEnd);
  return p;
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
}) {
  const hasActive = Object.values(filters).some((v) => v !== "");

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-panelborder px-4 pb-3 pt-3">
      {/* Provider */}
      <select
        value={filters.provider}
        onChange={(e) => onChange({ provider: e.target.value as FilterState["provider"] })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
      >
        <option value="">All Providers</option>
        <option value="CashApp">CashApp</option>
        <option value="Chime">Chime</option>
      </select>

      {/* Direction */}
      <select
        value={filters.direction}
        onChange={(e) => onChange({ direction: e.target.value as FilterState["direction"] })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
      >
        <option value="">All Directions</option>
        <option value="received">Received</option>
        <option value="sent">Sent</option>
      </select>

      {/* Player match */}
      <select
        value={filters.playerMatch}
        onChange={(e) => onChange({ playerMatch: e.target.value as FilterState["playerMatch"] })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
      >
        <option value="">All Match Statuses</option>
        <option value="matched">Matched</option>
        <option value="unmatched">Unmatched</option>
        <option value="needs_review">Needs Review</option>
      </select>

      {/* Recharged */}
      <select
        value={filters.recharged}
        onChange={(e) => onChange({ recharged: e.target.value as FilterState["recharged"] })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
      >
        <option value="">Recharged / Not</option>
        <option value="true">Recharged</option>
        <option value="false">Not Recharged</option>
      </select>

      {/* Date range */}
      <input
        type="date"
        value={filters.dateStart}
        onChange={(e) => onChange({ dateStart: e.target.value })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
        placeholder="From"
      />
      <input
        type="date"
        value={filters.dateEnd}
        onChange={(e) => onChange({ dateEnd: e.target.value })}
        className="rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-gold/40"
        placeholder="To"
      />

      {/* Search tag */}
      <input
        type="text"
        value={filters.searchTag}
        onChange={(e) => onChange({ searchTag: e.target.value })}
        placeholder="Search by tag…"
        className="min-w-[140px] rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/40"
      />

      {/* Search player */}
      <input
        type="text"
        value={filters.searchPlayer}
        onChange={(e) => onChange({ searchPlayer: e.target.value })}
        placeholder="Search by player…"
        className="min-w-[140px] rounded-lg border border-panelborder bg-emerald-950 px-2.5 py-1.5 text-xs text-emerald-100 placeholder-emerald-200/30 focus:outline-none focus:ring-1 focus:ring-gold/40"
      />

      {/* Reset button - only shown when a filter is active */}
      {hasActive && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PaymentActivityClientProps {
  initialData: EmployeePaymentTransaction[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  shopId?: string | null;
}

export function PaymentActivityClient({
  initialData,
  initialHasMore,
  initialNextCursor,
  shopId,
}: PaymentActivityClientProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [transactions, setTransactions] = useState<EmployeePaymentTransaction[]>(initialData);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Phase 4: selected transaction for AddPlayerPanel
  const [panelTransaction, setPanelTransaction] = useState<AddPlayerPanelTransaction | null>(null);

  // Phase 5: selected transaction for RechargePlayerDialog
  const [rechargeTransaction, setRechargeTransaction] = useState<RechargeDialogTransaction | null>(null);

  // Phase 5: active games for the recharge dropdown (loaded once on mount)
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);

  useEffect(() => {
    async function loadGames() {
      try {
        const res = await fetch("/api/payment/games");
        if (!res.ok) return;
        const json = await res.json();
        setActiveGames(json.games ?? []);
      } catch {
        // Non-fatal: dropdown will be empty, user cannot submit
      }
    }
    loadGames();
  }, []);

  // Fetch with new filters - replaces current list
  const fetchFiltered = useCallback((newFilters: FilterState) => {
    startTransition(async () => {
      setError(null);
      try {
        const params = buildParams(newFilters);
        const res = await fetch(`/api/payment/transactions?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json = await res.json();
        setTransactions(json.data ?? []);
        setHasMore(json.hasMore ?? false);
        setNextCursor(json.nextCursor ?? null);
      } catch (err) {
        setError("Failed to load transactions. Please try again.");
        console.error("[payment-activity-client] filter fetch error:", err);
      }
    });
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback(
    (patch: Partial<FilterState>) => {
      const updated = { ...filters, ...patch };
      setFilters(updated);
      fetchFiltered(updated);
    },
    [filters, fetchFiltered]
  );

  // Reset all filters
  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    fetchFiltered(DEFAULT_FILTERS);
  }, [fetchFiltered]);

  // Load more (append to current list using cursor)
  const handleLoadMore = useCallback(() => {
    if (!hasMore || !nextCursor || isPending) return;
    startTransition(async () => {
      setError(null);
      try {
        const params = buildParams(filters, nextCursor);
        const res = await fetch(`/api/payment/transactions?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json = await res.json();
        setTransactions((prev) => [...prev, ...(json.data ?? [])]);
        setHasMore(json.hasMore ?? false);
        setNextCursor(json.nextCursor ?? null);
      } catch (err) {
        setError("Failed to load more transactions. Please try again.");
        console.error("[payment-activity-client] load-more error:", err);
      }
    });
  }, [filters, hasMore, nextCursor, isPending]);

  // Phase 4: open the AddPlayerPanel for the selected transaction
  const handleAddPlayer = useCallback((txn: EmployeePaymentTransaction) => {
    setPanelTransaction({
      id: txn.id,
      provider: txn.provider,
      payment_account_name: txn.payment_account_name,
      business_payment_tag: txn.business_payment_tag,
      customer_payment_tag: txn.customer_payment_tag,
      customer_name: txn.customer_name,
      individual_amount: txn.individual_amount,
      occurred_at: txn.occurred_at,
      direction: txn.direction,
      transaction_status: txn.transaction_status,
      player_mapping_id: txn.player_mapping_id,
      player_name: txn.player_name,
      game_username: txn.game_username,
    });
  }, []);

  // Phase 4: patch the row after a successful save, preserving filters/pagination
  const handlePanelSaved = useCallback(
    (result: PlayerMappingResult & { transactionId: string }) => {
      if (!result.success) return;
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === result.transactionId
            ? {
                ...t,
                player_match_status: result.playerMatchStatus ?? t.player_match_status,
                player_name: result.playerName ?? t.player_name,
                player_mapping_id: result.mappingId ?? t.player_mapping_id,
                can_add_player: false,
              }
            : t
        )
      );
    },
    []
  );

  // Phase 5: open the RechargePlayerDialog for the selected transaction
  const handleRecharge = useCallback((txn: EmployeePaymentTransaction) => {
    setRechargeTransaction({
      id: txn.id,
      provider: txn.provider,
      payment_account_name: txn.payment_account_name,
      business_payment_tag: txn.business_payment_tag,
      customer_payment_tag: txn.customer_payment_tag,
      customer_name: txn.customer_name,
      player_name: txn.player_name,
      game_username: txn.game_username,
      individual_amount: txn.individual_amount,
      occurred_at: txn.occurred_at,
      direction: txn.direction,
      transaction_status: txn.transaction_status,
      player_mapping_id: txn.player_mapping_id,
    });
  }, []);

  // Realtime: subscribe to new counted payment_transactions for this shop.
  // When a new row arrives, set a banner instead of auto-prepending
  // (auto-prepend can confuse the employee mid-task).
  const realtimeStatus = usePaymentRealtime({
    shopId: shopId ?? null,
    countedOnly: true,
    onNewTransaction: () => {
      setHasNewActivity(true);
    },
  });

  // Dismiss the banner and reload from top
  const handleActivityBannerRefresh = useCallback(() => {
    setHasNewActivity(false);
    fetchFiltered(filters);
  }, [filters, fetchFiltered]);

  // Phase 5: patch the row after a successful recharge
  const handleRechargeSaved = useCallback(
    (result: RechargeResult & { transactionId: string }) => {
      if (!result.success) return;
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === result.transactionId
            ? {
                ...t,
                recharge_status: result.rechargeStatus ?? t.recharge_status,
                specific_recharge_bonus: result.bonusGiven ?? t.specific_recharge_bonus,
                specific_missing_recharge: result.missingRecharge ?? t.specific_missing_recharge,
                coins_recharged: result.coinsRecharged ?? t.coins_recharged,
                recharge_id: result.rechargeId ?? t.recharge_id,
                can_recharge: false,
              }
            : t
        )
      );
    },
    []
  );

  return (
    <>
      <div id="payment-activity" className="card-panel overflow-hidden">
        {/* Section header */}
        <div className="border-b border-panelborder px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Payment Activity</h2>
        </div>

        {/* Filter bar */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />

        {/* Realtime connection indicator (subtle, top-right of header) */}
        {/* We show nothing if disabled/connecting — only show error */}
        {realtimeStatus === "error" && (
          <div className="px-4 py-1 text-xs text-warning/70">
            Live updates unavailable — refresh manually.
          </div>
        )}

        {/* New activity banner */}
        {hasNewActivity && !isPending && (
          <button
            type="button"
            onClick={handleActivityBannerRefresh}
            className="w-full border-b border-positive/20 bg-positive/10 px-4 py-2 text-left text-xs font-semibold text-positive hover:bg-positive/20 transition-colors"
          >
            ↑ New payment activity — click to refresh
          </button>
        )}

        {/* Loading overlay */}
        {isPending && (
          <div className="px-4 py-3 text-xs text-emerald-200/40">Loading…</div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 my-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Table */}
        {!isPending && (
          <PaymentTransactionTable
            transactions={transactions}
            showDate={true}
            onAddPlayer={handleAddPlayer}
            onRecharge={handleRecharge}
            emptyMessage="No transactions match the current filters."
          />
        )}

        {/* Load More */}
        {hasMore && !isPending && (
          <div className="border-t border-panelborder px-4 py-3 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Phase 4: AddPlayerPanel drawer */}
      <AddPlayerPanel
        transaction={panelTransaction}
        onClose={() => setPanelTransaction(null)}
        onSaved={handlePanelSaved}
      />

      {/* Phase 5: RechargePlayerDialog */}
      <RechargePlayerDialog
        transaction={rechargeTransaction}
        games={activeGames}
        onClose={() => setRechargeTransaction(null)}
        onSaved={handleRechargeSaved}
      />
    </>
  );
}
