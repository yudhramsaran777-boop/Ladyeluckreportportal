// Core shift report calculation formulas for Lady E Luck Portal.
//
// IMPORTANT RULES:
// - startingCoinsAfterAdd = openingCoinsBeforeAdd + adminAddedCoins  (auto-computed, never manual)
// - Normal Coin Difference = Starting Coins After Add - Ending Coins
// - Real Recharge = Starting Coins After Add + Redeem Coins - Ending Coins
// - Game Cost per game = max(profit, 0) × rate  (negative games owe $0 in game fees)
//   → Game cost is based on PROFIT only. Recharge is NEVER a basis for game cost.
// - Report-level Game Cost = plain sum of the per-game costs. NO scaling by net
//   profit — each distributor bills its own game's positive profit regardless of
//   other games' losses. (The old scaled formula understated cost; removed 2026-07-16.)
// - If total report profit <= 0: Game Cost = 0, True Profit = Total Profit

export interface GameRowInput {
  openingCoinsBeforeAdd: number;
  adminAddedCoins: number;
  endingCoins: number;
  redeemCoins: number;
  redeemAmount: number;
  gameCostPercentage: number;
}

export interface GameRowCalculated {
  startingCoinsAfterAdd: number;
  normalCoinDifference: number;
  realRecharge: number;
  gameCost: number;
  grossProfit: number;
  trueProfit: number;
}

// Stored-entry helpers (for reading back from the DB)
// NOTE: game_cost intentionally excluded — must always be re-derived.
export interface StoredGameEntryLike {
  normal_coin_difference?: number | string | null;
  gross_profit?: number | string | null;
  game_cost_percentage?: number | string | null;
}

function toFiniteNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateGameCost(
  normalDifference: number,
  gameCostPercentage: number
): number {
  return (Math.max(normalDifference, 0) * gameCostPercentage) / 100;
}

export function profitFromStoredEntry(entry: StoredGameEntryLike): number {
  return toFiniteNumber(entry.normal_coin_difference ?? entry.gross_profit);
}

export function gameCostFromStoredEntry(entry: StoredGameEntryLike): number {
  const profit = profitFromStoredEntry(entry);
  if (profit <= 0) return 0;
  return calculateGameCost(profit, toFiniteNumber(entry.game_cost_percentage));
}

export function trueProfitFromStoredEntry(entry: StoredGameEntryLike): number {
  return profitFromStoredEntry(entry) - gameCostFromStoredEntry(entry);
}

// Live calculation (used while entering a shift)

export function calculateGameRow(input: GameRowInput): GameRowCalculated {
  const {
    openingCoinsBeforeAdd,
    adminAddedCoins,
    endingCoins,
    redeemCoins,
    redeemAmount,
    gameCostPercentage,
  } = input;

  const startingCoinsAfterAdd = openingCoinsBeforeAdd + adminAddedCoins;
  const normalCoinDifference = startingCoinsAfterAdd - endingCoins;
  const realRecharge = startingCoinsAfterAdd + redeemCoins - endingCoins;
  const gameCost = calculateGameCost(normalCoinDifference, gameCostPercentage);
  const grossProfit = normalCoinDifference;
  const trueProfit = normalCoinDifference - gameCost;

  return {
    startingCoinsAfterAdd,
    normalCoinDifference,
    realRecharge,
    gameCost,
    grossProfit,
    trueProfit,
  };
}

export function sumReportTotals(
  rows: GameRowCalculated[]
): {
  totalRealRecharge: number;
  totalGameCost: number;
  totalGrossProfit: number;
  totalTrueProfit: number;
} {
  const totalRealRecharge = rows.reduce((sum, r) => sum + r.realRecharge, 0);
  const totalGrossProfit = rows.reduce((sum, r) => sum + r.grossProfit, 0);
  const positiveGameCosts = rows.reduce((sum, r) => sum + r.gameCost, 0);
  const totalGameCost = totalGrossProfit > 0 ? positiveGameCosts : 0;
  const totalTrueProfit = totalGrossProfit > 0 ? totalGrossProfit - totalGameCost : totalGrossProfit;
  return { totalRealRecharge, totalGameCost, totalGrossProfit, totalTrueProfit };
}

// ─── CANONICAL REPORT TOTALS — the single source of truth for every view ────
//
// Business rule (confirmed by Luis, 2026-07-16):
// - Game cost is charged per game on POSITIVE profit only: max(profit, 0) × rate.
//   Negative games owe $0. Recharge is NEVER a basis for game cost.
// - Per report: if the report's total profit <= 0, game cost = 0 (zero-out rule).
// - NO scaling of game cost by net profit. The removed "scaled" formula
//   (game cost × totalProfit ÷ sumPositiveProfits) understated cost whenever a
//   report contained a losing game and MUST NOT be reintroduced.
//
// The stored per-entry `game_cost` column already equals max(profit, 0) × rate
// (enforced by migration 0025 and the employee submission flow), so these
// functions sum the stored values. Owner dashboard, owner reports, owner shift
// reports, manager dashboard, manager 24h shop report, and manager shift
// reports MUST all use these two functions so every view shows identical numbers.

export interface ReportTotals {
  totalRecharge: number;
  totalProfit: number;
  totalGameCost: number;
  totalTrueProfit: number;
}

export interface StoredShiftEntry {
  shift_report_id?: string | null;
  real_recharge?: number | string | null;
  normal_coin_difference?: number | string | null;
  game_cost?: number | string | null;
}

/**
 * Totals for entries that all belong to ONE shift report.
 * Game cost = sum of stored per-entry costs, zeroed out if the report lost money.
 */
export function singleReportTotalsFromStoredEntries(entries: StoredShiftEntry[]): ReportTotals {
  const totalRecharge = entries.reduce((sum, e) => sum + toFiniteNumber(e.real_recharge), 0);
  const totalProfit = entries.reduce((sum, e) => sum + toFiniteNumber(e.normal_coin_difference), 0);
  const storedCost = entries.reduce((sum, e) => sum + toFiniteNumber(e.game_cost), 0);
  const totalGameCost = totalProfit > 0 ? storedCost : 0;
  return {
    totalRecharge,
    totalProfit,
    totalGameCost,
    totalTrueProfit: totalProfit - totalGameCost,
  };
}

/**
 * Groups entries by shift_report_id, applies the per-report rule to each
 * report, then sums. Use for any multi-report view (dashboards, date ranges).
 */
export function reportTotalsFromStoredEntries(entries: StoredShiftEntry[]): ReportTotals {
  const byReport = new Map<string, StoredShiftEntry[]>();
  for (const entry of entries) {
    const id = String(entry.shift_report_id ?? "__unknown__");
    const list = byReport.get(id) ?? [];
    list.push(entry);
    byReport.set(id, list);
  }
  const totals: ReportTotals = { totalRecharge: 0, totalProfit: 0, totalGameCost: 0, totalTrueProfit: 0 };
  for (const [, group] of byReport) {
    const rt = singleReportTotalsFromStoredEntries(group);
    totals.totalRecharge += rt.totalRecharge;
    totals.totalProfit += rt.totalProfit;
    totals.totalGameCost += rt.totalGameCost;
    totals.totalTrueProfit += rt.totalTrueProfit;
  }
  return totals;
}

// ─── RANGE / GAME-NETTING RULE (confirmed by Luis, 2026-07-17) ──────────────
//
// Coin balances carry over between shifts. When players redeem, coins return
// to the game account and reduce what must be bought from the distributor
// later. So for a DATE RANGE the real distributor cost per game is:
//     max(net normal difference of that game over the range, 0) × rate
// - Netting happens WITHIN a game across reports (same coin balance).
// - A loss in one game NEVER offsets another game (different distributors).
// - No report-level zero-out here: positive games still need coins bought
//   even if the range's overall profit is negative.
// This is the ONLY correct formula for range KPIs (owner report, manager
// dashboard, manager 24h shop report). The per-report functions above remain
// for single-report displays, where each game appears once anyway.

export interface StoredRangeEntry extends StoredShiftEntry {
  game_code?: string | null;
  game_name?: string | null;
  game_cost_percentage?: number | string | null;
}

export interface RangeGameRow {
  name: string;
  recharge: number;
  net: number;
  rate: number;
  gameCost: number;
  trueProfit: number;
  count: number;
}

/** Per-game rows for a date range: nets each game's coin difference across
 *  all reports, then applies max(net, 0) × rate. Sorted by recharge desc. */
export function rangeGameRowsFromStoredEntries(entries: StoredRangeEntry[]): RangeGameRow[] {
  const byGame = new Map<string, RangeGameRow>();
  for (const e of entries) {
    const key = String(e.game_code ?? e.game_name ?? "Unknown");
    const current =
      byGame.get(key) ??
      { name: String(e.game_name ?? e.game_code ?? "Unknown"), recharge: 0, net: 0, rate: 0, gameCost: 0, trueProfit: 0, count: 0 };
    current.recharge += toFiniteNumber(e.real_recharge);
    current.net += toFiniteNumber(e.normal_coin_difference);
    const rate = toFiniteNumber(e.game_cost_percentage);
    if (rate > 0) current.rate = rate;
    current.count += 1;
    byGame.set(key, current);
  }
  for (const row of byGame.values()) {
    row.gameCost = (Math.max(row.net, 0) * row.rate) / 100;
    row.trueProfit = row.net - row.gameCost;
  }
  return Array.from(byGame.values()).sort((a, b) => b.recharge - a.recharge);
}

/** Range totals for ONE shop's entries. IMPORTANT: never mix shops in one
 *  call — coins do not move between shops, so net per shop separately and
 *  sum the results (the owner report sums its per-shop totals). */
export function rangeTotalsFromStoredEntries(entries: StoredRangeEntry[]): ReportTotals {
  const rows = rangeGameRowsFromStoredEntries(entries);
  const totals: ReportTotals = { totalRecharge: 0, totalProfit: 0, totalGameCost: 0, totalTrueProfit: 0 };
  for (const row of rows) {
    totals.totalRecharge += row.recharge;
    totals.totalProfit += row.net;
    totals.totalGameCost += row.gameCost;
    totals.totalTrueProfit += row.trueProfit;
  }
  return totals;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}
