import Link from "next/link";
import { Banknote, CreditCard, DollarSign, ListChecks, Store, Trophy, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DateRangeFilter } from "@/components/manager/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { PaymentDonutChart } from "@/components/charts/payment-donut-chart";
import { TopGamesBarChart } from "@/components/charts/top-games-bar-chart";
import { formatCurrency, formatNumber } from "@/lib/calculations";

interface OwnerReportContentProps {
  searchParams?: { start?: string; end?: string };
  detailed?: boolean;
}

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

function normalizePaymentMethod(value: string | null | undefined): string {
  const method = (value || "Other").trim().toLowerCase();
  if (method === "cashapp" || method === "cash app") return "CashApp";
  if (method === "chime") return "Chime";
  if (method === "zelle") return "Zelle";
  if (method === "venmo") return "Venmo";
  if (method === "bitcoin" || method === "btc") return "Bitcoin";
  return "Other";
}

function trueProfit(entry: any): number {
  const normalDifference = Number(entry.normal_coin_difference || 0);
  const gameCost = Number(entry.game_cost || 0);
  return normalDifference || gameCost ? normalDifference - gameCost : Number(entry.true_profit || 0);
}

function paymentDistribution(accounts: any[]) {
  const byType = new Map<string, number>();
  for (const account of accounts) {
    const type = normalizePaymentMethod(account.payment_type);
    byType.set(type, (byType.get(type) || 0) + 1);
  }
  return ["CashApp", "Chime", "Zelle", "Venmo", "Bitcoin", "Other"].map((name) => ({
    name,
    value: byType.get(name) || 0,
  }));
}

function topUsername(cashouts: any[]) {
  const byUsername = new Map<
    string,
    { username: string; facebook: string; game: string; amount: number; count: number }
  >();
  for (const cashout of cashouts) {
    const username = cashout.game_username || cashout.customer_facebook_name || "Unknown";
    const current =
      byUsername.get(username) || {
        username,
        facebook: cashout.customer_facebook_name || "-",
        game: cashout.game_name || "-",
        amount: 0,
        count: 0,
      };
    current.amount += Number(cashout.amount || 0);
    current.count += 1;
    if (cashout.customer_facebook_name) current.facebook = cashout.customer_facebook_name;
    if (cashout.game_name) current.game = cashout.game_name;
    byUsername.set(username, current);
  }
  return Array.from(byUsername.values()).sort((a, b) => b.amount - a.amount)[0] || null;
}

function topCashoutGame(cashouts: any[]) {
  const byGame = new Map<string, number>();
  for (const cashout of cashouts) {
    const game = cashout.game_name || "Unknown";
    byGame.set(game, (byGame.get(game) || 0) + Number(cashout.amount || 0));
  }
  const [name, amount] = Array.from(byGame.entries()).sort((a, b) => b[1] - a[1])[0] || [];
  return name ? { name, amount } : null;
}

function topGames(entries: any[]) {
  const byGame = new Map<
    string,
    { name: string; recharge: number; normalDifference: number; gameCost: number; trueProfit: number; count: number }
  >();
  for (const entry of entries) {
    const name = entry.game_name || entry.game_code || "Unknown";
    const current =
      byGame.get(name) ||
      { name, recharge: 0, normalDifference: 0, gameCost: 0, trueProfit: 0, count: 0 };
    current.recharge += Number(entry.real_recharge || 0);
    current.normalDifference += Number(entry.normal_coin_difference || 0);
    current.gameCost += Number(entry.game_cost || 0);
    current.trueProfit += trueProfit(entry);
    current.count += 1;
    byGame.set(name, current);
  }
  return Array.from(byGame.values()).sort((a, b) => b.recharge - a.recharge);
}

function cashoutGameRows(cashouts: any[]) {
  const byGame = new Map<string, { name: string; amount: number; count: number }>();
  for (const cashout of cashouts) {
    const name = cashout.game_name || "Unknown";
    const current = byGame.get(name) || { name, amount: 0, count: 0 };
    current.amount += Number(cashout.amount || 0);
    current.count += 1;
    byGame.set(name, current);
  }
  return Array.from(byGame.values()).sort((a, b) => b.amount - a.amount);
}

function totals(entries: any[], cashouts: any[]) {
  return {
    recharge: entries.reduce((sum, e) => sum + Number(e.real_recharge || 0), 0),
    cashout: cashouts.reduce((sum, c) => sum + Number(c.amount || 0), 0),
    profit: entries.reduce((sum, e) => sum + Number(e.gross_profit || 0), 0),
    trueProfit: entries.reduce((sum, e) => sum + trueProfit(e), 0),
    cashoutCount: cashouts.length,
    cashAppCashout: cashouts.reduce(
      (sum, c) => sum + (normalizePaymentMethod(c.payment_method) === "CashApp" ? Number(c.amount || 0) : 0),
      0
    ),
    chimeCashout: cashouts.reduce(
      (sum, c) => sum + (normalizePaymentMethod(c.payment_method) === "Chime" ? Number(c.amount || 0) : 0),
      0
    ),
  };
}

function PaymentDistributionMini({ data }: { data: { name: string; value: number }[] }) {
  const visible = data.filter((row) => row.value > 0 || row.name === "CashApp" || row.name === "Chime");
  return (
    <div className="space-y-2">
      {visible.map((row) => (
        <div key={row.name} className="flex items-center justify-between text-sm">
          <span className="text-emerald-100/70">{row.name}</span>
          <span className="font-semibold text-white">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ShopSection({
  shop,
  managerName,
  start,
  end,
  entries,
  cashouts,
  paymentAccounts,
  detailed,
}: {
  shop: any;
  managerName: string;
  start: string;
  end: string;
  entries: any[];
  cashouts: any[];
  paymentAccounts: any[];
  detailed?: boolean;
}) {
  const shopTotals = totals(entries, cashouts);
  const winner = topUsername(cashouts);
  const games = topGames(entries);
  const paymentRows = paymentDistribution(paymentAccounts);
  const cashoutGames = cashoutGameRows(cashouts);

  return (
    <section className="card-panel p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{shop.name}</h2>
            <StatusBadge status={shop.status || "active"} />
          </div>
          <p className="mt-1 text-xs text-emerald-200/50">
            Manager: {managerName || "Unassigned"} · {start} through {end}
          </p>
        </div>
        <Link
          href={`/owner/reports?start=${start}&end=${end}`}
          className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold hover:bg-gold/20"
        >
          View Shop Report
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Recharge" value={formatCurrency(shopTotals.recharge)} icon={DollarSign} />
        <KpiCard label="Total Cashout" value={formatCurrency(shopTotals.cashout)} icon={Wallet} />
        <KpiCard label="Total Profit" value={formatCurrency(shopTotals.profit)} icon={Banknote} />
        <KpiCard
          label="Total True Profit"
          value={formatCurrency(shopTotals.trueProfit)}
          icon={Trophy}
          trendDirection={shopTotals.trueProfit >= 0 ? "up" : "down"}
        />
        <KpiCard label="Cashouts Done" value={formatNumber(shopTotals.cashoutCount)} icon={ListChecks} />
        <KpiCard label="Active Payment Accounts" value={formatNumber(paymentAccounts.length)} icon={CreditCard} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-panelborder bg-emerald-950/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Top Username</h3>
          {winner ? (
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-gold">{winner.username}</p>
              <p className="text-emerald-100/70">{winner.facebook} · {winner.game}</p>
              <p className="text-warning">{formatCurrency(winner.amount)} across {winner.count} cashouts</p>
            </div>
          ) : (
            <EmptyState message="No cashout data for this range." />
          )}
        </div>
        <div className="rounded-lg border border-panelborder bg-emerald-950/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Payment Account Distribution</h3>
          {paymentAccounts.length === 0 ? <EmptyState message="No active payment accounts." /> : <PaymentDistributionMini data={paymentRows} />}
        </div>
        <div className="rounded-lg border border-panelborder bg-emerald-950/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Cashout Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-emerald-100/70">CashApp</span><span className="text-white">{formatCurrency(shopTotals.cashAppCashout)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">Chime</span><span className="text-white">{formatCurrency(shopTotals.chimeCashout)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">Cashouts</span><span className="text-white">{shopTotals.cashoutCount}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Top Games by Recharge</h3>
          {games.length === 0 ? (
            <EmptyState message="No game recharge data for this range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Recharge</th>
                    <th className="py-2 pr-4">Game Cost</th>
                    <th className="py-2 pr-4">True Profit</th>
                    <th className="py-2 pr-4">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {games.slice(0, detailed ? 10 : 5).map((game) => (
                    <tr key={game.name}>
                      <td className="py-2 pr-4 text-emerald-100">{game.name}</td>
                      <td className="py-2 pr-4 text-emerald-100">{formatCurrency(game.recharge)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(game.gameCost)}</td>
                      <td className={game.trueProfit >= 0 ? "py-2 pr-4 text-positive" : "py-2 pr-4 text-danger"}>{formatCurrency(game.trueProfit)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{game.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Cashout by Game</h3>
          {cashoutGames.length === 0 ? (
            <EmptyState message="No cashout data for this range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Cashouts</th>
                    <th className="py-2 pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {cashoutGames.slice(0, detailed ? 10 : 5).map((row) => (
                    <tr key={row.name}>
                      <td className="py-2 pr-4 text-emerald-100">{row.name}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{row.count}</td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export async function OwnerReportContent({ searchParams, detailed = false }: OwnerReportContentProps) {
  const { start, end } = parseRange(searchParams);
  const supabase = createClient();

  const [{ data: shops }, { data: managers }, { data: paymentAccounts }, { data: reports }] =
    await Promise.all([
      supabase.from("shops").select("id, name, status").order("name"),
      supabase.from("profiles").select("full_name, shop_id").eq("role", "manager"),
      supabase.from("payment_accounts").select("id, shop_id, payment_type, status"),
      supabase
        .from("shift_reports")
        .select("id, shop_id, employee_id, employee_name, shift_date, status, created_at")
        .gte("shift_date", start)
        .lte("shift_date", end)
        .order("shift_date", { ascending: false }),
    ]);

  const safeShops = shops || [];
  const reportIds = (reports || []).map((report) => report.id);

  const [{ data: entries }, { data: cashouts }, { data: employees }] = await Promise.all([
    reportIds.length
      ? supabase
          .from("shift_game_entries")
          .select(
            "shift_report_id, game_code, game_name, real_recharge, normal_coin_difference, game_cost, gross_profit, true_profit"
          )
          .in("shift_report_id", reportIds)
      : Promise.resolve({ data: [] }),
    reportIds.length
      ? supabase
          .from("shift_cashouts")
          .select(
            "id, shift_report_id, shop_id, employee_id, customer_facebook_name, game_username, game_name, amount, payment_method, payment_tag, page_source_name, created_at"
          )
          .in("shift_report_id", reportIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const activePaymentAccounts = (paymentAccounts || []).filter((account) => account.status === "active");
  const reportById = new Map((reports || []).map((report) => [report.id, report]));
  const shopById = new Map(safeShops.map((shop) => [shop.id, shop]));
  const employeeNameById = new Map((employees || []).map((employee) => [employee.id, employee.full_name]));
  const managerByShop = new Map<string, string>();
  for (const manager of managers || []) {
    if (manager.shop_id && !managerByShop.has(manager.shop_id)) {
      managerByShop.set(manager.shop_id, manager.full_name || "Manager");
    }
  }

  const entriesByShop = new Map<string, any[]>();
  for (const entry of entries || []) {
    const report = reportById.get(entry.shift_report_id);
    if (!report?.shop_id) continue;
    entriesByShop.set(report.shop_id, [...(entriesByShop.get(report.shop_id) || []), entry]);
  }

  const cashoutsByShop = new Map<string, any[]>();
  for (const cashout of cashouts || []) {
    const shopId = cashout.shop_id || reportById.get(cashout.shift_report_id)?.shop_id;
    if (!shopId) continue;
    cashoutsByShop.set(shopId, [...(cashoutsByShop.get(shopId) || []), cashout]);
  }

  const globalEntries = entries || [];
  const globalCashouts = cashouts || [];
  const globalTotals = totals(globalEntries, globalCashouts);
  const globalPaymentRows = paymentDistribution(activePaymentAccounts);
  const globalTopGames = topGames(globalEntries);
  const globalWinner = topUsername(globalCashouts);
  const globalCashoutGame = topCashoutGame(globalCashouts);

  const shopStats = safeShops.map((shop) => {
    const shopEntries = entriesByShop.get(shop.id) || [];
    const shopCashouts = cashoutsByShop.get(shop.id) || [];
    const shopPaymentAccounts = activePaymentAccounts.filter((account) => account.shop_id === shop.id);
    return {
      shop,
      entries: shopEntries,
      cashouts: shopCashouts,
      paymentAccounts: shopPaymentAccounts,
      totals: totals(shopEntries, shopCashouts),
    };
  });

  const topShops = shopStats
    .filter((row) => row.totals.recharge || row.totals.cashout || row.totals.trueProfit)
    .sort((a, b) => b.totals.trueProfit - a.totals.trueProfit);

  const activeShops = safeShops.filter((shop) => (shop.status || "active") === "active");

  return (
    <div className="space-y-6">
      <DateRangeFilter start={start} end={end} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <KpiCard label="Total Recharge" value={formatCurrency(globalTotals.recharge)} icon={DollarSign} trend="All shops" />
        <KpiCard label="Total Cashout" value={formatCurrency(globalTotals.cashout)} icon={Wallet} trend="All shops" />
        <KpiCard label="Total Profit" value={formatCurrency(globalTotals.profit)} icon={Banknote} trend="Gross profit" />
        <KpiCard
          label="Total True Profit"
          value={formatCurrency(globalTotals.trueProfit)}
          icon={Trophy}
          trendDirection={globalTotals.trueProfit >= 0 ? "up" : "down"}
        />
        <KpiCard label="Total Cashouts Done" value={formatNumber(globalTotals.cashoutCount)} icon={ListChecks} />
        <KpiCard label="Active Shops" value={formatNumber(activeShops.length)} icon={Store} />
        <KpiCard label="Active Payment Accounts" value={formatNumber(activePaymentAccounts.length)} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-panel p-4 xl:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-white">Top Performing Shops</h2>
          {topShops.length === 0 ? (
            <EmptyState message="No shop performance data yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Shop</th>
                    <th className="py-2 pr-4">Recharge</th>
                    <th className="py-2 pr-4">Cashout</th>
                    <th className="py-2 pr-4">Profit</th>
                    <th className="py-2 pr-4">True Profit</th>
                    <th className="py-2 pr-4">Cashouts Done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {topShops.map((row, index) => (
                    <tr key={row.shop.id}>
                      <td className="py-2 pr-4 text-gold">{index + 1}</td>
                      <td className="py-2 pr-4 text-emerald-100">{row.shop.name}</td>
                      <td className="py-2 pr-4 text-emerald-100">{formatCurrency(row.totals.recharge)}</td>
                      <td className="py-2 pr-4 text-warning">{formatCurrency(row.totals.cashout)}</td>
                      <td className="py-2 pr-4 text-emerald-100/70">{formatCurrency(row.totals.profit)}</td>
                      <td className={row.totals.trueProfit >= 0 ? "py-2 pr-4 text-positive" : "py-2 pr-4 text-danger"}>
                        {formatCurrency(row.totals.trueProfit)}
                      </td>
                      <td className="py-2 pr-4 text-emerald-100/70">{row.totals.cashoutCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Global Payment Account Distribution</h2>
          {activePaymentAccounts.length === 0 ? (
            <EmptyState message="No active payment accounts." />
          ) : (
            <>
              <PaymentDonutChart data={globalPaymentRows.filter((row) => row.value > 0)} />
              <PaymentDistributionMini data={globalPaymentRows} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-panel p-4 xl:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-white">Global Top Games by Recharge</h2>
          <TopGamesBarChart data={globalTopGames.map((game) => ({ name: game.name, recharge: game.recharge }))} />
        </div>
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Global Cashout Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-emerald-100/70">Total Cashout</span><span className="text-white">{formatCurrency(globalTotals.cashout)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">CashApp</span><span className="text-white">{formatCurrency(globalTotals.cashAppCashout)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">Chime</span><span className="text-white">{formatCurrency(globalTotals.chimeCashout)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">Top Username</span><span className="text-gold">{globalWinner?.username || "-"}</span></div>
            <div className="flex justify-between"><span className="text-emerald-100/70">Top Cashout Game</span><span className="text-gold">{globalCashoutGame?.name || "-"}</span></div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h2 className="gold-underline text-xl font-bold text-white">Shop-by-Shop Report</h2>
          <p className="mt-2 text-sm text-emerald-200/50">Each shop is shown separately for the selected date range.</p>
        </div>
        {safeShops.length === 0 ? (
          <EmptyState message="No shop data available." />
        ) : (
          shopStats.map((row) => (
            <ShopSection
              key={row.shop.id}
              shop={row.shop}
              managerName={managerByShop.get(row.shop.id) || ""}
              start={start}
              end={end}
              entries={row.entries}
              cashouts={row.cashouts}
              paymentAccounts={row.paymentAccounts}
              detailed={detailed}
            />
          ))
        )}
      </div>

      {detailed && (
        <div className="card-panel p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Cashout Detail</h2>
          {globalCashouts.length === 0 ? (
            <EmptyState message="No cashouts for this date range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-4">Shop</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4">Username</th>
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Tag</th>
                    <th className="py-2 pr-4">Page Source</th>
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Date/Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {globalCashouts.map((cashout) => {
                    const shopId = cashout.shop_id || reportById.get(cashout.shift_report_id)?.shop_id;
                    return (
                      <tr key={cashout.id}>
                        <td className="py-2 pr-4 text-emerald-100">{shopById.get(shopId)?.name || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{cashout.customer_facebook_name || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{cashout.game_username || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{cashout.game_name || "-"}</td>
                        <td className="py-2 pr-4 font-semibold text-warning">{formatCurrency(Number(cashout.amount || 0))}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{normalizePaymentMethod(cashout.payment_method)}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{cashout.payment_tag || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{cashout.page_source_name || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{employeeNameById.get(cashout.employee_id) || "-"}</td>
                        <td className="py-2 pr-4 text-emerald-100/70">{new Date(cashout.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
