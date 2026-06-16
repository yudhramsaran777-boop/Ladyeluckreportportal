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

export interface StoredGameEntryLike {
  normal_coin_difference?: number | string | null;
  gross_profit?: number | string | null;
  game_cost_percentage?: number | string | null;
  game_cost?: number | string | null;
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

  const hasGameCostPercentage =
    entry.game_cost_percentage !== null && entry.game_cost_percentage !== undefined;
  if (hasGameCostPercentage) {
    return calculateGameCost(profit, toFiniteNumber(entry.game_cost_percentage));
  }

  return Math.max(toFiniteNumber(entry.game_cost), 0);
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
  return rows.reduce(
    (acc, r) => ({
      totalRealRecharge: acc.totalRealRecharge + r.realRecharge,
      totalGameCost: acc.totalGameCost + r.gameCost,
      totalGrossProfit: acc.totalGrossProfit + r.grossProfit,
      totalTrueProfit: acc.totalTrueProfit + r.trueProfit,
    }),
    {
      totalRealRecharge: 0,
      totalGameCost: 0,
      totalGrossProfit: 0,
      totalTrueProfit: 0,
    }
  );
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
