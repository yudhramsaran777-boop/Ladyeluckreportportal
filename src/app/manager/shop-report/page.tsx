import { Banknote, CreditCard, DollarSign, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { DateRangeFilter } from "@/components/manager/date-range-filter";
import {
  formatCurrency,
  formatNumber,
  reportTotalsFromStoredEntries,
} from "@/lib/calculations";
import { fetchAllByIds, fetchAllRows } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseRange(searchParams?: { start?: string; end?: string }) {
  const today = localDateString();
  const minStart = localDateString(addMonths(new Date(), -2));
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  let error: string | null = null;
  let start = searchParams?.start && valid.test(searchParams.start) ? searchParams.start : today;
  let end = searchParams?.end && valid.test(searchParams.end) ? searchParams.end : today;

  if (start < minStart) {
    start = minStart;
    error = "You can only view reports up to 2 months back.";
  }
  if (end > today) end = today;
  if (end < start) end = start;

  return { start, end, minStart, maxEnd: today, error };
}

function normalizePaymentMethod(value: string | null | undefined): string {
  const method = (value || "Other").trim().toLowerCase();
  if (method === "cashapp" || method === "cash app") return "CashApp";
  if (method === "chime") return "Chime";
  if (method === "zelle") return "Zelle";
  if (method === "venmo") return "Venmo";
  if (method === "bitcoin" || method === "btc") return "Bitcoin";
  return "Other";
}


export default async function ManagerShopReportPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string };
}) {
  const { start, end, minStart, maxEnd, error } = parseRange(searchParams);
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userData.user!.id)
    .single();

  if (!profile?.shop_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="24 Hour Shop Report" showDateFilter={false} />
        <EmptyState message="No shop assigned. Contact owner." />
      </div>
    );
  }

  // fetchAllRows / fetchAllByIds: complete results past Supabase's 1,000-row cap.
  // A 2-month range can easily exceed 1,000 game entries.
  const reports = await fetchAllRows<any>((from, to) =>
    supabase
      .from("shift_reports")
      .select("id, shift_date")
      .eq("shop_id", profile.shop_id)
      .gte("shift_date", start)
      .lte("shift_date", end)
      .order("shift_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const reportIds = (reports || []).map((r) => r.id);

  const [entries, cashouts] = await Promise.all([
    fetchAllByIds<any>(reportIds, (ids, from, to) =>
      supabase
        .from("shift_game_entries")
        .select(
          "shift_report_id, game_name, real_recharge, redeem_amount, normal_coin_difference, game_cost_percentage, game_cost, gross_profit, true_profit"
        )
        .in("shift_report_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllByIds<any>(reportIds, (ids, from, to) =>
      supabase
        .from("shift_cashouts")
        .select(
          "id, shift_report_id, customer_facebook_name, game_username, game_name, amount, payment_method, payment_tag, page_source_name, created_at"
        )
        .eq("shop_id", profile.shop_id)
        .in("shift_report_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  // Group entries by report, compute grouped-game totals per report, then aggregate
  const entriesByReport = new Map<string, any[]>();
  for (const entry of entries || []) {
    const list = entriesByReport.get(entry.shift_report_id) ?? [];
    list.push(entry);
    entriesByReport.set(entry.shift_report_id, list);
  }

  // KPI totals: canonical formula shared with owner + manager dashboards.
  const rangeTotals = reportTotalsFromStoredEntries(entries || []);
  const totalRecharge = rangeTotals.totalRecharge;
  const totalGameCost = rangeTotals.totalGameCost;
  const totalProfit = rangeTotals.totalProfit;
  const totalTrueProfit = rangeTotals.totalTrueProfit;

  // Aggregate game-level rows across all reports (stored game_cost, zero-out per report)
  const rechargeGameMap = new Map<
    string,
    { game: string; recharge: number; normalDifference: number; gameCostPercent: number; gameCostPercentCount: number; gameCost: number; profit: number; trueProfit: number }
  >();

  for (const [, reportEntries] of entriesByReport) {
    // Zero-out rule: if the report lost money overall, no game fee for any game in it.
    const reportProfit = reportEntries.reduce((s: number, e: any) => s + Number(e.normal_coin_difference || 0), 0);
    const isPositive = reportProfit > 0;

    for (const e of reportEntries) {
      const gameName = e.game_name || "Unknown";
      const profit   = Number(e.normal_coin_difference || 0);
      const recharge = Number(e.real_recharge || 0);
      const entryCost = isPositive ? Number(e.game_cost || 0) : 0;
      const current = rechargeGameMap.get(gameName) ||
        { game: gameName, recharge: 0, normalDifference: 0, gameCostPercent: 0, gameCostPercentCount: 0, gameCost: 0, profit: 0, trueProfit: 0 };
      current.recharge          += recharge;
      current.normalDifference  += profit;
      current.gameCostPercent   += Number(e.game_cost_percentage || 0);
      current.gameCostPercentCount += 1;
      current.gameCost          += entryCost;
      current.profit            += profit;
      current.trueProfit        += profit - entryCost;
      rechargeGameMap.set(gameName, current);
    }
  }
  const rechargeGameRows = Array.from(rechargeGameMap.values()).sort((a, b) => b.recharge - a.recharge);

  const totalRedeems = (cashouts || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const cashAppCashout = (cashouts || []).reduce(
    (sum, c) => sum + (normalizePaymentMethod(c.payment_method) === "CashApp" ? Number(c.amount || 0) : 0),
    0
  );
  const chimeCashout = (cashouts || []).reduce(
    (sum, c) => sum + (normalizePaymentMethod(c.payment_method) === "Chime" ? Number(c.amount || 0) : 0),
    0
  );

  const cashoutGameMap = new Map<string, { game: string; count: number; amount: number }>();
  for (const cashout of cashouts || []) {
    const game = cashout.game_name || "Unknown";
    const current = cashoutGameMap.get(game) || { game, count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(cashout.amount || 0);
    cashoutGameMap.set(game, current);
  }
  const cashoutGameRows = Array.from(cashoutGameMap.values()).sort((a, b) => b.amount - a.amount);

  const usernameMap = new Map<
    string,
    {
      username: string;
      facebook: string;
      games: Set<string>;
      methods: Set<string>;
      tags: Set<string>;
      pages: Set<string>;
      amount: number;
      count: number;
      latestTime: string | null;
    }
  >();
  for (const cashout of cashouts || []) {
    const username = cashout.game_username || cashout.customer_facebook_name || "Unknown";
    const current =
      usernameMap.get(username) ||
      {
        username,
        facebook: cashout.customer_facebook_name || "-",
        games: new Set<string>(),
        methods: new Set<string>(),
        tags: new Set<string>(),
        pages: new Set<string>(),
        amount: 0,
        count: 0,
        latestTime: null,
      };
    current.amount += Number(cashout.amount || 0);
    current.count += 1;
    current.latestTime =
      !current.latestTime || String(cashout.created_at) > current.latestTime
        ? cashout.created_at
        : current.latestTime;
    if (cashout.customer_facebook_name) current.facebook = cashout.customer_facebook_name;
    if (cashout.game_name) current.games.add(cashout.game_name);
    current.methods.add(normalizePaymentMethod(cashout.payment_method));
    if (cashout.payment_tag) current.tags.add(cashout.payment_tag);
    if (cashout.page_source_name) current.pages.add(cashout.page_source_name);
    usernameMap.set(username, current);
  }
  const usernameRows = Array.from(usernameMap.values()).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <PageHeader title="24 Hour Shop Report" showDateFilter={false} />
      <DateRangeFilter start={start} end={end} minStart={minStart} maxEnd={maxEnd} error={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-8">
        <KpiCard label="Real Recharge" value={formatCurrency(totalRecharge)} icon={DollarSign} trend="Selected range" />
        <KpiCard label="Redeems" value={formatCurrency(totalRedeems)} icon={Wallet} trend="Cashout total" />
        <KpiCard label="Game Cost" value={formatCurrency(totalGameCost)} icon={CreditCard} trend="Positive game profit x cost %" />
        <KpiCard label="Profit" value={formatCurrency(totalProfit)} icon={TrendingUp} trend="Normal difference" />
        <KpiCard
          label="True Profit"
          value={formatCurrency(totalTrueProfit)}
          icon={Banknote}
          trendDirection={totalTrueProfit >= 0 ? "up" : "down"}
          trend="Normal diff - game cost"
        />
        <KpiCard label="Cashouts Done" value={formatNumber((cashouts || []).length)} icon={ListChecks} trend="Entries" />
        <KpiCard label="CashApp Cashout" value={formatCurrency(cashAppCashout)} icon={CreditCard} trend="CashApp only" />
        <KpiCard label="Chime Cashout" value={formatCurrency(chimeCashout)} icon={CreditCard} trend="Chime only" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Cashout Games Overview</h2>
          {cashoutGameRows.length === 0 ? (
            <EmptyState message="No cashouts in this range" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Cashouts</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {cashoutGameRows.map((row) => (
                    <tr key={row.game}>
                      <td className="py-2 pr-4 text-emerald-100">{row.game}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{row.count}</td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(row.amount)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">
                        {formatCurrency(row.count ? row.amount / row.count : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Real Recharge by Game</h2>
          {rechargeGameRows.length === 0 ? (
            <EmptyState message="No game entries in this range" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Real Recharge</th>
                    <th className="py-2 pr-4">Normal Diff</th>
                    <th className="py-2 pr-4">Game Cost %</th>
                    <th className="py-2 pr-4">Game Cost</th>
                    <th className="py-2 pr-4">Profit</th>
                    <th className="py-2 pr-4">True Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {rechargeGameRows.map((row) => (
                    <tr key={row.game}>
                      <td className="py-2 pr-4 text-emerald-100">{row.game}</td>
                      <td className="py-2 pr-4 text-emerald-100">{formatCurrency(row.recharge)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(row.normalDifference)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">
                        {formatNumber(row.gameCostPercentCount ? row.gameCostPercent / row.gameCostPercentCount : 0)}%
                      </td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(row.gameCost)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(row.profit)}</td>
                      <td className={row.trueProfit >= 0 ? "py-2 pr-4 text-positive" : "py-2 pr-4 text-danger"}>
                        {formatCurrency(row.trueProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card-panel p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">Cashout by Username and Amount</h2>
        {usernameRows.length === 0 ? (
          <EmptyState message="No username cashouts in this range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-emerald-200/50">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Games</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Tag</th>
                  <th className="py-2 pr-4">Page Source</th>
                  <th className="py-2 pr-4">Cashouts</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Latest Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {usernameRows.map((row) => (
                  <tr key={row.username}>
                    <td className="py-2 pr-4 text-emerald-100">{row.username}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{row.facebook}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{Array.from(row.games).join(", ") || "-"}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{Array.from(row.methods).join(", ")}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{Array.from(row.tags).join(", ") || "-"}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{Array.from(row.pages).join(", ") || "-"}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">{row.count}</td>
                    <td className="py-2 pr-4 font-semibold text-warning">{formatCurrency(row.amount)}</td>
                    <td className="py-2 pr-4 text-emerald-100/70">
                      {row.latestTime ? new Date(row.latestTime).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
