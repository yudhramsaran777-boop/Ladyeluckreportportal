import { describe, expect, it } from "vitest";
import {
  calculateGameCost,
  calculateGameRow,
  reportTotalsFromStoredEntries,
  singleReportTotalsFromStoredEntries,
  sumReportTotals,
  type StoredShiftEntry,
} from "./calculations";

// Regression fixture from docs/GAME_COST_DISCREPANCY_PLAN.md:
// Juwa +$1,000 @ 15%, Fire Kirin -$400 @ 12%. Net profit $600.
// Correct game cost is $150 (Juwa's full fee) — NEVER the old scaled $90.
const mixedReport: StoredShiftEntry[] = [
  {
    shift_report_id: "r1",
    real_recharge: 1200,
    normal_coin_difference: 1000,
    game_cost: 150, // max(1000, 0) × 15%
  },
  {
    shift_report_id: "r1",
    real_recharge: 300,
    normal_coin_difference: -400,
    game_cost: 0, // negative game owes $0
  },
];

describe("game cost business rule", () => {
  it("charges positive profit only, never negative", () => {
    expect(calculateGameCost(1000, 15)).toBe(150);
    expect(calculateGameCost(-400, 12)).toBe(0);
    expect(calculateGameCost(0, 15)).toBe(0);
  });

  it("never derives game cost from recharge", () => {
    // Same profit, wildly different recharge → identical game cost.
    const a = singleReportTotalsFromStoredEntries([
      { shift_report_id: "a", real_recharge: 10000, normal_coin_difference: 500, game_cost: 75 },
    ]);
    const b = singleReportTotalsFromStoredEntries([
      { shift_report_id: "b", real_recharge: 100, normal_coin_difference: 500, game_cost: 75 },
    ]);
    expect(a.totalGameCost).toBe(75);
    expect(b.totalGameCost).toBe(75);
  });
});

describe("regression: mixed winning/losing report ($150, never scaled $90)", () => {
  it("single-report totals use full positive-game cost with no scaling", () => {
    const rt = singleReportTotalsFromStoredEntries(mixedReport);
    expect(rt.totalRecharge).toBe(1500);
    expect(rt.totalProfit).toBe(600);
    expect(rt.totalGameCost).toBe(150); // NOT 90
    expect(rt.totalTrueProfit).toBe(450);
  });

  it("multi-report aggregation gives the same answer as the single-report path", () => {
    const single = singleReportTotalsFromStoredEntries(mixedReport);
    const multi = reportTotalsFromStoredEntries(mixedReport);
    expect(multi).toEqual(single);
  });
});

describe("report-level zero-out rule", () => {
  it("charges $0 game cost when the whole report lost money", () => {
    const rt = singleReportTotalsFromStoredEntries([
      { shift_report_id: "r2", real_recharge: 500, normal_coin_difference: 200, game_cost: 30 },
      { shift_report_id: "r2", real_recharge: 100, normal_coin_difference: -900, game_cost: 0 },
    ]);
    expect(rt.totalProfit).toBe(-700);
    expect(rt.totalGameCost).toBe(0);
    expect(rt.totalTrueProfit).toBe(-700);
  });

  it("applies zero-out per report, not across reports", () => {
    const losing: StoredShiftEntry[] = [
      { shift_report_id: "loss", real_recharge: 100, normal_coin_difference: -500, game_cost: 0 },
    ];
    const rt = reportTotalsFromStoredEntries([...mixedReport, ...losing]);
    // Winning report keeps its $150; losing report contributes $0 — no cross-report netting.
    expect(rt.totalGameCost).toBe(150);
    expect(rt.totalProfit).toBe(100);
    expect(rt.totalTrueProfit).toBe(-50);
  });
});

describe("all report paths agree (owner, manager dashboard, 24h report, lists)", () => {
  // Multi-shop, multi-report fixture with mixed winners/losers.
  const fixture: StoredShiftEntry[] = [
    ...mixedReport,
    { shift_report_id: "r3", real_recharge: 2000, normal_coin_difference: 800, game_cost: 96 },
    { shift_report_id: "r3", real_recharge: 400, normal_coin_difference: 100, game_cost: 15 },
    { shift_report_id: "r4", real_recharge: 700, normal_coin_difference: -50, game_cost: 0 },
  ];

  it("aggregate equals the sum of per-report totals", () => {
    const byReport = new Map<string, StoredShiftEntry[]>();
    for (const e of fixture) {
      const list = byReport.get(String(e.shift_report_id)) ?? [];
      list.push(e);
      byReport.set(String(e.shift_report_id), list);
    }
    let recharge = 0, profit = 0, cost = 0, trueProfit = 0;
    for (const [, group] of byReport) {
      const rt = singleReportTotalsFromStoredEntries(group);
      recharge += rt.totalRecharge;
      profit += rt.totalProfit;
      cost += rt.totalGameCost;
      trueProfit += rt.totalTrueProfit;
    }
    const agg = reportTotalsFromStoredEntries(fixture);
    expect(agg.totalRecharge).toBeCloseTo(recharge, 10);
    expect(agg.totalProfit).toBeCloseTo(profit, 10);
    expect(agg.totalGameCost).toBeCloseTo(cost, 10);
    expect(agg.totalTrueProfit).toBeCloseTo(trueProfit, 10);
    // Sanity: r1 $150 + r3 ($96 + $15) + r4 $0
    expect(agg.totalGameCost).toBe(261);
  });

  it("handles string values from Supabase numeric columns", () => {
    const rt = singleReportTotalsFromStoredEntries([
      { shift_report_id: "s1", real_recharge: "100.50", normal_coin_difference: "40.25", game_cost: "6.04" },
    ]);
    expect(rt.totalRecharge).toBeCloseTo(100.5);
    expect(rt.totalGameCost).toBeCloseTo(6.04);
  });
});

describe("employee live entry (calculateGameRow + sumReportTotals) matches stored path", () => {
  it("produces the same $150 for the mixed report", () => {
    const juwa = calculateGameRow({
      openingCoinsBeforeAdd: 5000,
      adminAddedCoins: 0,
      endingCoins: 4000, // profit 1000
      redeemCoins: 200,
      redeemAmount: 200,
      gameCostPercentage: 15,
    });
    const fireKirin = calculateGameRow({
      openingCoinsBeforeAdd: 2000,
      adminAddedCoins: 0,
      endingCoins: 2400, // profit -400
      redeemCoins: 700,
      redeemAmount: 700,
      gameCostPercentage: 12,
    });
    expect(juwa.gameCost).toBe(150);
    expect(fireKirin.gameCost).toBe(0);

    const totals = sumReportTotals([juwa, fireKirin]);
    expect(totals.totalGrossProfit).toBe(600);
    expect(totals.totalGameCost).toBe(150); // NOT 90
    expect(totals.totalTrueProfit).toBe(450);
  });
});
