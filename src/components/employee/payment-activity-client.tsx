"use client";

// ============================================================================
// Lady E Luck Portal - PaymentActivityClient
// Phase 3: Client-side filter state + "Load More" pagination for the full
// payment activity table on /employee/payment-info.
//
// Receives initial SSR data from PaymentActivitySection (Server Component).
// Subsequent filter changes and pagination call /api/payment/transactions.
// The API route derives shop_id from the authenticated session - it is never
// passed from this component.
// ============================================================================

import { useState, useCallback, useTransition } from "react";
import type { EmployeePaymentTransaction } from "@/lib/payment/payment-types";
import { PaymentTransactionTable } from "@/components/payment/payment-transaction-table";

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
}

export function PaymentActivityClient({
  initialData,
  initialHasMore,
  initialNextCursor,
}: PaymentActivityClientProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [transactions, setTransactions] = useState<EmployeePaymentTransaction[]>(initialData);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
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
  );
}
