// Core shift report calculation formulas for Lady E Luck Portal.
//
// IMPORTANT RULES:
// - startingCoinsAfterAdd = openingCoinsBeforeAdd + adminAddedCoins  (auto-computed, never manual)
// - Normal Coin Difference = Starting Coins After Add - Ending Coins
// - Real Recharge = Starting Coins After Add + Redeem Coins - Ending Coins
// - Game Cost = max(Normal Coin Difference, 0) * (Game Cost Percentage / 100)
// - Profit = Normal Coin Difference
// - True Profit = Profit - non-negative Game Cost
// - If Profit <= 0: Game Cost = 0, True Profit = Profit

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
// NOTE: game_cost is intentionally excluded — game cost must always be re-derived
// from normal_coin_difference × game_cost_percentage, never from a stored value
// that may have been calculated from real_recharge in older data.
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

export function calculateReportTotals(entries: StoredEntryForReportTotals[]): ReportTotals {
  const totalRecharge = entries.reduce((sum, e) => sum + toFiniteNumber(e.real_recharge), 0);
  const totalProfit = entries.reduce((sum, e) => sum + toFiniteNumber(e.normal_coin_difference), 0);
  const positiveGameCosts = entries.reduce((sum, e) => {
    const profit = toFiniteNumber(e.normal_coin_difference);
    if (profit <= 0) return sum;
    return sum + calculateGameCost(profit, toFiniteNumber(e.game_cost_percentage));
  }, 0);
  const totalGameCost = totalProfit > 0 ? positiveGameCosts : 0;
  const totalTrueProfit = totalProfit > 0 ? totalProfit - totalGameCost : totalProfit;
  return { totalRecharge, totalProfit, totalGameCost, totalTrueProfit };
}

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
