// Core shift report calculation formulas for Lady E Luck Portal.
//
// IMPORTANT RULES:
// - startingCoinsAfterAdd = openingCoinsBeforeAdd + adminAddedCoins  (auto-computed, never manual)
// - Normal Coin Difference = Starting Coins After Add - Ending Coins
// - Real Recharge = Starting Coins After Add + Redeem Coins - Ending Coins
// - Game Cost per game = max(profit, 0) × rate  (negative games owe $0 in game fees)
// - Report-level Game Cost = sum(per-game costs) × (totalProfit / sumPositiveProfits)
//   → scales the cost down so the effective rate on net profit = weighted rate of positive games
//   → this keeps effective rate ≤ max game rate (never above 15%)
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

// ─── Report-level totals from stored DB entries ─────────────────────────────

export interface StoredEntryForReportTotals {
  shift_report_id?: string | null;
  game_name?: string | null;
  normal_coin_difference?: number | string | null;
  real_recharge?: number | string | null;
  game_cost_percentage?: number | string | null;
}

export interface ReportTotals {
  totalRecharge: number;
  totalProfit: number;
  totalGameCost: number;
  totalTrueProfit: number;
}

export interface GroupedGameTotals {
  gameName: string;
  realRecharge: number;
  normalDifference: number;
  gameCostPercentage: number;
  gameCost: number;   // max(profit, 0) × rate — for per-row display
  profit: number;
  trueProfit: number;
}

/**
 * Groups entries by game_name, computes per-game cost = max(profit, 0) × rate.
 * Negative-profit games owe $0 in game fees. The report-level scaling in
 * calculateReportTotalsFromGroupedGames keeps the total effective rate ≤ max game rate.
 */
export function calculateGroupedGameTotals(entries: StoredEntryForReportTotals[]): GroupedGameTotals[] {
  const byGame = new Map<string, { recharge: number; profit: number; costPctSum: number; count: number }>();
  for (const entry of entries) {
    const name = entry.game_name ?? "Unknown";
    const current = byGame.get(name) ?? { recharge: 0, profit: 0, costPctSum: 0, count: 0 };
    current.recharge += toFiniteNumber(entry.real_recharge);
    current.profit += toFiniteNumber(entry.normal_coin_difference);
    current.costPctSum += toFiniteNumber(entry.game_cost_percentage);
    current.count += 1;
    byGame.set(name, current);
  }
  return Array.from(byGame.entries()).map(([gameName, g]) => {
    const gameCostPercentage = g.count > 0 ? g.costPctSum / g.count : 0;
    // Negative games owe $0 — they get coins back which will generate future recharge revenue.
    const gameCost = g.profit > 0 ? (g.profit * gameCostPercentage) / 100 : 0;
    return {
      gameName,
      realRecharge: g.recharge,
      normalDifference: g.profit,
      gameCostPercentage,
      gameCost,
      profit: g.profit,
      trueProfit: g.profit - gameCost,
    };
  });
}

/**
 * Computes report totals from already-grouped-by-game rows.
 *
 * Per-game rule: negative games → $0 fee (handled in calculateGroupedGameTotals).
 * Report-level rule: if totalProfit <= 0, totalGameCost = 0.
 *
 * Scaling rule: when losing games drag totalProfit below sumPositiveProfits,
 * the effective rate on net profit would exceed any game's actual rate without scaling.
 * We scale: totalGameCost = sum(per-game costs) × (totalProfit / sumPositiveProfits).
 * This keeps the effective rate = weighted rate of positive games ≤ max game rate (15%).
 */
export function calculateReportTotalsFromGroupedGames(groupedGames: GroupedGameTotals[]): ReportTotals {
  const totalRecharge = groupedGames.reduce((sum, g) => sum + g.realRecharge, 0);
  const totalProfit = groupedGames.reduce((sum, g) => sum + g.profit, 0);

  if (totalProfit <= 0) {
    return { totalRecharge, totalProfit, totalGameCost: 0, totalTrueProfit: totalProfit };
  }

  const sumPositiveProfits = groupedGames.reduce((sum, g) => sum + Math.max(g.profit, 0), 0);
  const rawGameCost = groupedGames.reduce((sum, g) => sum + g.gameCost, 0);

  // Scale game cost to net profit so effective rate stays within range of actual game rates.
  const totalGameCost = sumPositiveProfits > 0
    ? Math.max(rawGameCost * totalProfit / sumPositiveProfits, 0)
    : 0;

  const totalTrueProfit = totalProfit - totalGameCost;
  return { totalRecharge, totalProfit, totalGameCost, totalTrueProfit };
}

/**
 * Full pipeline for a single report's entries:
 * 1. Group entries by game
 * 2. Compute game cost per grouped game
 * 3. Apply report-level rule on grouped totals
 */
export function calculateReportTotals(entries: StoredEntryForReportTotals[]): ReportTotals {
  const groupedGames = calculateGroupedGameTotals(entries);
  return calculateReportTotalsFromGroupedGames(groupedGames);
}

/**
 * Groups entries by shift_report_id, applies calculateReportTotals to each group,
 * then sums. Use for multi-report views (owner dashboard, date ranges).
 */
export function aggregateAcrossReports(entries: StoredEntryForReportTotals[]): ReportTotals {
  const byReport = new Map<string, StoredEntryForReportTotals[]>();
  for (const entry of entries) {
    const id = entry.shift_report_id ?? "__unknown__";
    const list = byReport.get(id) ?? [];
    list.push(entry);
    byReport.set(id, list);
  }
  let totalRecharge = 0, totalProfit = 0, totalGameCost = 0, totalTrueProfit = 0;
  for (const [, group] of byReport) {
    const rt = calculateReportTotals(group);
    totalRecharge += rt.totalRecharge;
    totalProfit += rt.totalProfit;
    totalGameCost += rt.totalGameCost;
    totalTrueProfit += rt.totalTrueProfit;
  }
  return { totalRecharge, totalProfit, totalGameCost, totalTrueProfit };
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
