import Link from "next/link";
import { CreditCard, DollarSign, TrendingUp, Wallet, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { TopGamesBarChart } from "@/components/charts/top-games-bar-chart";
import { DateRangeFilter } from "@/components/manager/date-range-filter";
import { formatCurrency, formatNumber } from "@/lib/calculations";

export const dynamic = "force-dynamic";

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseRange(searchParams?: { start?: string; end?: string }) {
  const today = localDateString();
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  const start = searchParams?.start && valid.test(searchParams.start) ? searchParams.start : today;
  let end = searchParams?.end && valid.test(searchParams.end) ? searchParams.end : today;
  if (end < start) end = start;
  return { start, end };
}

function trueProfit(entry: any): number {
  const normalDifference = Number(entry.normal_coin_difference || 0);
  const gameCost = Number(entry.game_cost || 0);
  return normalDifference || gameCost ? normalDifference - gameCost : Number(entry.true_profit || 0);
}

function profit(entry: any): number {
  return Number(entry.normal_coin_difference ?? entry.gross_profit ?? 0);
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string };
}) {
  const { start, end } = parseRange(searchParams);
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userData.user!.id)
    .single();

  const shopId = profile?.shop_id;

  if (!shopId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manager Dashboard" showDateFilter={false} />
        <EmptyState message="No shop assigned. Contact owner." />
      </div>
    );
  }

  const [{ data: shop }, { data: paymentAccounts }, { data: reports }] = await Promise.all([
    supabase.from("shops").select("name").eq("id", shopId).single(),
    supabase.from("payment_accounts").select("id, payment_type, status").eq("shop_id", shopId),
    supabase
      .from("shift_reports")
      .select("id, employee_name, shift_date, shift_interval, status, created_at")
      .eq("shop_id", shopId)
      .gte("shift_date", start)
      .lte("shift_date", end)
      .order("shift_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const reportIds = (reports || []).map((r) => r.id);

  const [{ data: entries }, { data: cashouts }] = await Promise.all([
    reportIds.length
      ? supabase
          .from("shift_game_entries")
          .select(
            "shift_report_id, game_code, game_name, real_recharge, redeem_amount, normal_coin_difference, game_cost, gross_profit, true_profit"
          )
          .in("shift_report_id", reportIds)
      : Promise.resolve({ data: [] }),
    reportIds.length
      ? supabase
          .from("shift_cashouts")
          .select(
            "id, shift_report_id, customer_facebook_name, game_username, game_name, amount, payment_method, payment_tag, page_source_name, created_at"
          )
          .eq("shop_id", shopId)
          .in("shift_report_id", reportIds)
      : Promise.resolve({ data: [] }),
  ]);

  const activePaymentAccounts = (paymentAccounts || []).filter((p) => p.status === "active");
  const totalRecharge = (entries || []).reduce((sum, e) => sum + Number(e.real_recharge || 0), 0);
  const totalRedeem = (cashouts || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalGameCost = (entries || []).reduce((sum, e) => sum + Number(e.game_cost || 0), 0);
  const totalProfit = (entries || []).reduce((sum, e) => sum + profit(e), 0);
  const totalTrueProfit = (entries || []).reduce((sum, e) => sum + trueProfit(e), 0);

  const gameMap = new Map<string, { name: string; recharge: number }>();
  for (const entry of entries || []) {
    const name = entry.game_name || entry.game_code || "Unknown";
    const current = gameMap.get(name) || { name, recharge: 0 };
    current.recharge += Number(entry.real_recharge || 0);
    gameMap.set(name, current);
  }
  const topGamesData = Array.from(gameMap.values()).sort((a, b) => b.recharge - a.recharge);

  const winnerMap = new Map<
    string,
    { username: string; facebook: string; games: Set<string>; total: number; count: number }
  >();
  for (const cashout of cashouts || []) {
    const username = cashout.game_username || cashout.customer_facebook_name || "Unknown";
    const current =
      winnerMap.get(username) ||
      {
        username,
        facebook: cashout.customer_facebook_name || "-",
        games: new Set<string>(),
        total: 0,
        count: 0,
      };
    current.total += Number(cashout.amount || 0);
    current.count += 1;
    if (cashout.game_name) current.games.add(cashout.game_name);
    if (cashout.customer_facebook_name) current.facebook = cashout.customer_facebook_name;
    winnerMap.set(username, current);
  }
  const topWinners = Array.from(winnerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const totalsByReport = new Map<
    string,
    { recharge: number; normalDifference: number; gameCost: number; profit: number; redeem: number; cashoutCount: number; trueProfit: number }
  >();
  for (const entry of entries || []) {
    const current = totalsByReport.get(entry.shift_report_id) || {
      recharge: 0,
      normalDifference: 0,
      gameCost: 0,
      profit: 0,
      redeem: 0,
      cashoutCount: 0,
      trueProfit: 0,
    };
    current.recharge += Number(entry.real_recharge || 0);
    current.normalDifference += Number(entry.normal_coin_difference || 0);
    current.gameCost += Number(entry.game_cost || 0);
    current.profit += profit(entry);
    current.trueProfit += trueProfit(entry);
    totalsByReport.set(entry.shift_report_id, current);
  }
  for (const cashout of cashouts || []) {
    const current = totalsByReport.get(cashout.shift_report_id) || {
      recharge: 0,
      normalDifference: 0,
      gameCost: 0,
      profit: 0,
      redeem: 0,
      cashoutCount: 0,
      trueProfit: 0,
    };
    current.redeem += Number(cashout.amount || 0);
    current.cashoutCount += 1;
    totalsByReport.set(cashout.shift_report_id, current);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Daily Shop Overview - ${shop?.name || "Shop"}`} showDateFilter={false} />
      <DateRangeFilter start={start} end={end} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <KpiCard label="Shop Recharge" value={formatCurrency(totalRecharge)} icon={DollarSign} trend="Selected range" />
        <KpiCard label="Shop Redeem" value={formatCurrency(totalRedeem)} icon={Wallet} trend="Selected range" />
        <KpiCard label="Shop Game Cost" value={formatCurrency(totalGameCost)} icon={CreditCard} trend="Normal diff x cost %" />
        <KpiCard label="Shop Profit" value={formatCurrency(totalProfit)} icon={TrendingUp} trend="Normal difference" />
        <KpiCard
          label="Shop True Profit"
          value={formatCurrency(totalTrueProfit)}
          icon={Trophy}
          trend={totalTrueProfit >= 0 ? "Positive range" : "Negative range"}
          trendDirection={totalTrueProfit >= 0 ? "up" : "down"}
        />
        <KpiCard label="Cashouts Done" value={formatNumber((cashouts || []).length)} icon={Users} trend="Selected range" />
        <KpiCard
          label="Active Payment Accounts"
          value={formatNumber(activePaymentAccounts.length)}
          icon={CreditCard}
          trend="CashApp + Chime"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Top Games by Real Recharge</h2>
          <TopGamesBarChart data={topGamesData} />
          {totalRecharge > 0 && (
            <div className="mt-3 space-y-2">
              {topGamesData.slice(0, 5).map((game) => (
                <div key={game.name} className="flex items-center justify-between text-sm">
                  <span className="text-emerald-100">{game.name}</span>
                  <span className="text-emerald-100/70">
                    {formatCurrency(game.recharge)} ({Math.round((game.recharge / totalRecharge) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Top Usernames That Won</h2>
          {topWinners.length === 0 ? (
            <EmptyState message="No cashouts in this range" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Username</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Total Won</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {topWinners.map((winner) => (
                    <tr key={winner.username}>
                      <td className="py-2 pr-4 text-emerald-100">{winner.username}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{winner.facebook}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">
                        {Array.from(winner.games).join(", ") || "-"}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-warning">
                        {formatCurrency(winner.total)}
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
        <h2 className="mb-4 text-sm font-semibold text-white">Recent Submitted Reports</h2>
        {(reports || []).length === 0 ? (
          <EmptyState message="No shift reports in this range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-emerald-200/50">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Shift Date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Recharge</th>
                  <th className="py-2 pr-4">Normal Diff</th>
                  <th className="py-2 pr-4">Game Cost</th>
                  <th className="py-2 pr-4">Profit</th>
                  <th className="py-2 pr-4">Redeem</th>
                  <th className="py-2 pr-4">Cashouts Done</th>
                  <th className="py-2 pr-4">True Profit</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {(reports || []).map((report) => {
                  const totals = totalsByReport.get(report.id) || {
                    recharge: 0,
                    normalDifference: 0,
                    gameCost: 0,
                    profit: 0,
                    redeem: 0,
                    cashoutCount: 0,
                    trueProfit: 0,
                  };
                  return (
                    <tr key={report.id}>
                      <td className="py-2 pr-4 text-emerald-100">{report.employee_name || "-"}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{report.shift_date}</td>
                      <td className="py-2 pr-4"><StatusBadge status={report.status} /></td>
                      <td className="py-2 pr-4 text-emerald-100">{formatCurrency(totals.recharge)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.normalDifference)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.gameCost)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(totals.profit)}</td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(totals.redeem)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatNumber(totals.cashoutCount)}</td>
                      <td className={totals.trueProfit >= 0 ? "py-2 pr-4 text-positive" : "py-2 pr-4 text-danger"}>
                        {formatCurrency(totals.trueProfit)}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/manager/shift-reports/${report.id}`}
                          className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20"
                        >
                          View/Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
