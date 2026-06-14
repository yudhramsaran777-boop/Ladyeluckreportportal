"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, PlayCircle, Send, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  GAMES,
  PAYMENT_METHODS,
  PAYMENT_TAG_LABELS,
  SHIFT_INTERVALS,
  type GameCode,
  type PaymentMethod,
} from "@/lib/constants";
import { calculateGameRow, formatCurrency, formatNumber, sumReportTotals } from "@/lib/calculations";

interface GameSettingRow {
  game_code: string;
  game_name: string;
  cost_percentage: number;
}

interface PageSourceRow {
  id: string;
  page_name: string;
  platform?: string | null;
}

interface CashoutRow {
  id: string;
  customer_facebook_name: string | null;
  game_code: string;
  game_name: string;
  game_username: string | null;
  amount: number;
  payment_method: string;
  payment_tag: string | null;
  page_source_id: string | null;
  page_source_name: string | null;
  notes: string | null;
  status: string;
}

interface ReportRow {
  id: string;
  shift_date: string;
  shift_interval: string;
  status: string;
  notes: string | null;
}

interface GameEntryRow {
  game_code: string;
  opening_coins_before_add: number;
  admin_added_coins: number;
  starting_coins_after_add: number;
  ending_coins: number;
  notes: string | null;
}

interface ShiftReportClientProps {
  shopId: string;
  employeeId: string;
  employeeName: string;
  gameSettings: GameSettingRow[];
  pageSources: PageSourceRow[];
  initialReport: ReportRow | null;
  initialEntries: GameEntryRow[];
  initialCashouts: CashoutRow[];
  editorRole?: "employee" | "manager";
}

interface GameRowState {
  opening: string;
  adminAdded: string;
  ending: string;
  notes: string;
}

const emptyGameRow: GameRowState = {
  opening: "",
  adminAdded: "",
  ending: "",
  notes: "",
};

const emptyCashoutForm = {
  customer_facebook_name: "",
  game_code: GAMES[0].code,
  game_username: "",
  amount: "",
  payment_method: "CashApp" as PaymentMethod,
  payment_tag: "",
  page_source_id: "",
  notes: "",
};

function toNumber(value: string | number | null | undefined): number {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberToInput(value: unknown): string {
  const numeric = toNumber(value as string | number | null | undefined);
  return numeric === 0 ? "" : String(numeric);
}

export function ShiftReportClient({
  shopId,
  employeeId,
  employeeName,
  gameSettings,
  pageSources,
  initialReport,
  initialEntries,
  initialCashouts,
  editorRole = "employee",
}: ShiftReportClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [report, setReport] = useState<ReportRow | null>(initialReport);
  const [shiftDate, setShiftDate] = useState(
    initialReport?.shift_date || new Date().toISOString().slice(0, 10)
  );
  const [shiftInterval, setShiftInterval] = useState(
    initialReport?.shift_interval || SHIFT_INTERVALS[0]
  );
  const [shiftNotes, setShiftNotes] = useState(initialReport?.notes || "");
  const [reportStatus, setReportStatus] = useState(initialReport?.status || "draft");

  const [gameRows, setGameRows] = useState<Record<string, GameRowState>>(() => {
    const map: Record<string, GameRowState> = {};
    for (const g of GAMES) {
      const existing = initialEntries.find((e) => e.game_code === g.code);
      map[g.code] = existing
        ? {
            opening: numberToInput(existing.opening_coins_before_add),
            adminAdded: numberToInput(existing.admin_added_coins),
            ending: numberToInput(existing.ending_coins),
            notes: existing.notes || "",
          }
        : { ...emptyGameRow };
    }
    return map;
  });

  const [cashouts, setCashouts] = useState<CashoutRow[]>(initialCashouts);
  const [cashoutForm, setCashoutForm] = useState({ ...emptyCashoutForm });
  const [editingCashoutId, setEditingCashoutId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const costByCode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of GAMES) map[g.code] = g.defaultCostPercentage;
    for (const gs of gameSettings) map[gs.game_code] = Number(gs.cost_percentage);
    return map;
  }, [gameSettings]);

  // redeem totals per game from cashouts
  const redeemByGame = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of GAMES) map[g.code] = 0;
    for (const c of cashouts) {
      map[c.game_code] = (map[c.game_code] || 0) + Number(c.amount || 0);
    }
    return map;
  }, [cashouts]);

  const computedRows = useMemo(() => {
    return GAMES.map((g) => {
      const row = gameRows[g.code] || emptyGameRow;
      const redeemAmount = redeemByGame[g.code] || 0;
      const calc = calculateGameRow({
        openingCoinsBeforeAdd: toNumber(row.opening),
        adminAddedCoins: toNumber(row.adminAdded),
        endingCoins: toNumber(row.ending),
        redeemCoins: redeemAmount,
        redeemAmount,
        gameCostPercentage: costByCode[g.code] ?? g.defaultCostPercentage,
      });
      return { game: g, row, redeemAmount, calc };
    });
  }, [gameRows, redeemByGame, costByCode]);

  const totals = useMemo(
    () => sumReportTotals(computedRows.map((r) => r.calc)),
    [computedRows]
  );

  const isEditable =
    editorRole === "manager"
      ? !report || ["draft", "submitted", "needs_correction", "approved"].includes(report.status)
      : !report ||
        report.status === "draft" ||
        report.status === "submitted" ||
        report.status === "needs_correction";
  const isReadOnly = !isEditable;
  const isSubmitted = report?.status === "submitted";
  const isNeedsCorrection = report?.status === "needs_correction";
  const canEditShiftInfo = editorRole === "manager";
  const showManagerFinancials = editorRole === "manager";

  function updateGameRow(code: string, field: keyof GameRowState, value: string) {
    setGameRows((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
  }

  async function startShift() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("shift_reports")
        .insert({
          shop_id: shopId,
          employee_id: employeeId,
          employee_name: employeeName,
          shift_date: shiftDate,
          shift_interval: shiftInterval,
          notes: shiftNotes,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      setReport(data as ReportRow);
      setMessage("Shift started. You can now enter game coins and redeems.");
    } catch (err: any) {
      setError(err?.message || "Failed to start shift");
    } finally {
      setBusy(false);
    }
  }

  async function addOrUpdateCashout(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    setError(null);

    const amount = Number(cashoutForm.amount) || 0;
    if (amount <= 0) {
      setError("Redeem/cashout amount must be greater than 0");
      return;
    }

    const game = GAMES.find((g) => g.code === cashoutForm.game_code);
    const pageSource = pageSources.find((p) => p.id === cashoutForm.page_source_id);

    const payload = {
      shift_report_id: report.id,
      shop_id: shopId,
      employee_id: employeeId,
      customer_facebook_name: cashoutForm.customer_facebook_name || null,
      game_code: cashoutForm.game_code,
      game_name: game?.name || cashoutForm.game_code,
      game_username: cashoutForm.game_username || null,
      amount,
      payment_method: cashoutForm.payment_method,
      payment_tag: cashoutForm.payment_tag || null,
      page_source_id: cashoutForm.page_source_id || null,
      page_source_name: pageSource?.page_name || null,
      notes: cashoutForm.notes || null,
      status: "pending",
    };

    setBusy(true);
    try {
      if (editingCashoutId) {
        const { data, error } = await supabase
          .from("shift_cashouts")
          .update(payload)
          .eq("id", editingCashoutId)
          .select()
          .single();
        if (error) throw error;
        setCashouts((prev) =>
          prev.map((c) => (c.id === editingCashoutId ? (data as CashoutRow) : c))
        );
        setEditingCashoutId(null);
      } else {
        const { data, error } = await supabase
          .from("shift_cashouts")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setCashouts((prev) => [...prev, data as CashoutRow]);
      }
      setCashoutForm({ ...emptyCashoutForm });
    } catch (err: any) {
      setError(err?.message || "Failed to save redeem entry");
    } finally {
      setBusy(false);
    }
  }

  function startEditCashout(c: CashoutRow) {
    setEditingCashoutId(c.id);
    setCashoutForm({
      customer_facebook_name: c.customer_facebook_name || "",
      game_code: c.game_code as GameCode,
      game_username: c.game_username || "",
      amount: String(c.amount),
      payment_method: (c.payment_method as PaymentMethod) || "CashApp",
      payment_tag: c.payment_tag || "",
      page_source_id: c.page_source_id || "",
      notes: c.notes || "",
    });
  }

  async function deleteCashout(id: string) {
    if (!confirm("Delete this redeem entry?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("shift_cashouts").delete().eq("id", id);
      if (error) throw error;
      setCashouts((prev) => prev.filter((c) => c.id !== id));
      if (editingCashoutId === id) {
        setEditingCashoutId(null);
        setCashoutForm({ ...emptyCashoutForm });
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete redeem entry");
    } finally {
      setBusy(false);
    }
  }

  async function persistEntries(reportId: string) {
    // replace shift_game_entries
    const { error: deleteError } = await supabase
      .from("shift_game_entries")
      .delete()
      .eq("shift_report_id", reportId);
    if (deleteError) throw deleteError;

    const entries = computedRows.map(({ game, row, redeemAmount, calc }) => ({
      shift_report_id: reportId,
      game_code: game.code,
      game_name: game.name,
      opening_coins_before_add: toNumber(row.opening),
      admin_added_coins: toNumber(row.adminAdded),
      starting_coins_after_add: calc.startingCoinsAfterAdd,
      redeem_coins: redeemAmount,
      ending_coins: toNumber(row.ending),
      normal_coin_difference: calc.normalCoinDifference,
      real_recharge: calc.realRecharge,
      redeem_amount: redeemAmount,
      game_cost_percentage: costByCode[game.code] ?? game.defaultCostPercentage,
      game_cost: calc.gameCost,
      gross_profit: calc.grossProfit,
      true_profit: calc.trueProfit,
      notes: row.notes || null,
    }));

    const { error: insertError } = await supabase.from("shift_game_entries").insert(entries);
    if (insertError) throw insertError;
  }

  async function saveDraft() {
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      // update shift_reports header, keep status as-is
      const { error: reportError } = await supabase
        .from("shift_reports")
        .update({
          shift_date: shiftDate,
          shift_interval: shiftInterval,
          notes: shiftNotes,
          ...(editorRole === "manager" ? { status: reportStatus } : {}),
        })
        .eq("id", report.id);
      if (reportError) throw reportError;

      await persistEntries(report.id);

      if (editorRole === "manager") {
        setReport((prev) => (prev ? { ...prev, status: reportStatus } : prev));
      }
      setMessage(
        editorRole === "manager"
          ? "Report changes saved."
          : isSubmitted
            ? "Submitted report changes saved."
            : "Draft saved. You can continue editing later."
      );
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save draft");
    } finally {
      setBusy(false);
    }
  }

  async function submitShift() {
    if (!report) return;
    const confirmMsg =
      editorRole === "manager"
        ? "Save this report status?"
        : isNeedsCorrection
          ? "Resubmit this shift report?"
          : isSubmitted
            ? "Update this submitted shift report?"
            : "Submit this shift report?";
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    setError(null);
    try {
      // update shift_reports header
      const { error: reportError } = await supabase
        .from("shift_reports")
        .update({
          shift_date: shiftDate,
          shift_interval: shiftInterval,
          notes: shiftNotes,
          status: editorRole === "manager" ? reportStatus : "submitted",
        })
        .eq("id", report.id);
      if (reportError) throw reportError;

      await persistEntries(report.id);

      setReport((prev) =>
        prev ? { ...prev, status: editorRole === "manager" ? reportStatus : "submitted" } : prev
      );
      setMessage(editorRole === "manager" ? "Report status updated." : "Shift report submitted successfully.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to submit shift report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-positive/40 bg-positive/10 px-3 py-2 text-sm text-positive">
          {message}
        </div>
      )}
      {isNeedsCorrection && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-300">
          Your manager requested corrections to this shift report. Make the necessary changes and
          click Resubmit Shift Report when done.
        </div>
      )}
      {isReadOnly && report && (
        <div className="rounded-lg border border-panelborder bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200/80">
          This shift report is read-only. Status:{" "}
          <StatusBadge status={report.status} />
        </div>
      )}

      {/* Shift info */}
      <div className="card-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Shift Information</h2>
          {report && <StatusBadge status={report.status} />}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-emerald-200/80">Employee</label>
            <input
              disabled
              value={employeeName}
              className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-emerald-200/80">Shift Date</label>
            <input
              type="date"
              disabled={!!report && !canEditShiftInfo}
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-emerald-200/80">Shift Interval</label>
            <select
              disabled={!!report && !canEditShiftInfo}
              value={shiftInterval}
              onChange={(e) => setShiftInterval(e.target.value)}
              className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
            >
              {SHIFT_INTERVALS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1 block text-sm text-emerald-200/80">Notes</label>
            <input
              disabled={isReadOnly}
              value={shiftNotes}
              onChange={(e) => setShiftNotes(e.target.value)}
              placeholder="Optional notes about this shift"
              className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
            />
          </div>
          {editorRole === "manager" && report && (
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-sm text-emerald-200/80">Status</label>
              <select
                disabled={isReadOnly}
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value)}
                className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="needs_correction">Needs Correction</option>
                <option value="approved">Approved</option>
                <option value="locked">Locked</option>
              </select>
            </div>
          )}
        </div>

        {!report && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={startShift}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
            >
              <PlayCircle size={16} />
              Start Shift
            </button>
          </div>
        )}

        {isReadOnly && report && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setReport(null);
                setShiftDate(new Date().toISOString().slice(0, 10));
                setShiftInterval(SHIFT_INTERVALS[0]);
                setShiftNotes("");
                setGameRows(() => {
                  const map: Record<string, GameRowState> = {};
                  for (const g of GAMES) map[g.code] = { ...emptyGameRow };
                  return map;
                });
                setCashouts([]);
                setCashoutForm({ ...emptyCashoutForm });
                setEditingCashoutId(null);
                setMessage(null);
              }}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-panelborder px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-800/40 disabled:opacity-50"
            >
              <PlayCircle size={16} />
              Start New Shift
            </button>
          </div>
        )}
      </div>

      {!report ? (
        <div className="card-panel p-4">
          <EmptyState
            message="No active shift yet"
            hint="Set your shift date and interval, then click Start Shift to begin entering game coins and redeems."
          />
        </div>
      ) : (
        <>
          {/* Game coin table */}
          <div className="card-panel p-4">
            <h2 className="mb-4 text-sm font-semibold text-white">Game Coin Entries</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-emerald-200/50">
                    <th className="py-2 pr-3">Game</th>
                    <th className="py-2 pr-3">Opening Coins</th>
                    <th className="py-2 pr-3">Admin Added</th>
                    <th className="py-2 pr-3">Starting After Add</th>
                    <th className="py-2 pr-3">Redeem Coins</th>
                    <th className="py-2 pr-3">Ending Coins</th>
                    <th className="py-2 pr-3">Normal Diff</th>
                    <th className="py-2 pr-3">Real Recharge</th>
                    {showManagerFinancials && <th className="py-2 pr-3">Game Cost %</th>}
                    {showManagerFinancials && <th className="py-2 pr-3">Game Cost</th>}
                    {showManagerFinancials && <th className="py-2 pr-3">Profit</th>}
                    {showManagerFinancials && <th className="py-2 pr-3">True Profit</th>}
                    <th className="py-2 pr-3">Redeem Amount</th>
                    <th className="py-2 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panelborder">
                  {computedRows.map(({ game, row, redeemAmount, calc }) => (
                    <tr key={game.code}>
                      <td className="py-2 pr-3 text-emerald-100">
                        {game.name}
                        <span className="ml-1 text-xs text-emerald-200/40">({game.code})</span>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="0"
                          disabled={isReadOnly}
                          value={row.opening}
                          onChange={(e) => updateGameRow(game.code, "opening", e.target.value)}
                          className="w-24 rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="0"
                          disabled={isReadOnly}
                          value={row.adminAdded}
                          onChange={(e) => updateGameRow(game.code, "adminAdded", e.target.value)}
                          className="w-24 rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div
                          className="flex w-24 items-center rounded-lg border border-panelborder/50 bg-emerald-900/30 px-2 py-1 text-sm font-semibold text-gold"
                          title="Auto-calculated: Opening + Admin Added"
                        >
                          {calc.startingCoinsAfterAdd.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-emerald-100/80">{redeemAmount}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="0"
                          disabled={isReadOnly}
                          value={row.ending}
                          onChange={(e) => updateGameRow(game.code, "ending", e.target.value)}
                          className="w-24 rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
                        />
                      </td>
                      <td className="py-2 pr-3 text-emerald-100/70">
                        {calc.normalCoinDifference.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-emerald-100">
                        {calc.realRecharge.toFixed(2)}
                      </td>
                      {showManagerFinancials && (
                        <td className="py-2 pr-3 text-emerald-100/70">
                          {formatNumber(costByCode[game.code] ?? game.defaultCostPercentage)}%
                        </td>
                      )}
                      {showManagerFinancials && (
                        <td className="py-2 pr-3 text-emerald-100/70">
                          {formatCurrency(calc.gameCost)}
                        </td>
                      )}
                      {showManagerFinancials && (
                        <td className="py-2 pr-3 text-emerald-100/70">
                          {formatCurrency(calc.grossProfit)}
                        </td>
                      )}
                      {showManagerFinancials && (
                        <td className={calc.trueProfit >= 0 ? "py-2 pr-3 text-positive" : "py-2 pr-3 text-danger"}>
                          {formatCurrency(calc.trueProfit)}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-emerald-100/70">
                        {formatCurrency(redeemAmount)}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={row.notes}
                          onChange={(e) => updateGameRow(game.code, "notes", e.target.value)}
                          className="w-32 rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-sm font-semibold text-white">
                    <td className="py-2 pr-3">Totals</td>
                    <td colSpan={6} />
                    <td className="py-2 pr-3">{formatCurrency(totals.totalRealRecharge)}</td>
                    {showManagerFinancials && (
                      <>
                        <td />
                        <td className="py-2 pr-3">{formatCurrency(totals.totalGameCost)}</td>
                        <td className="py-2 pr-3">{formatCurrency(totals.totalGrossProfit)}</td>
                        <td className={totals.totalTrueProfit >= 0 ? "py-2 pr-3 text-positive" : "py-2 pr-3 text-danger"}>
                          {formatCurrency(totals.totalTrueProfit)}
                        </td>
                      </>
                    )}
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Redeem / cashout entry */}
          {isEditable && (
            <div className="card-panel p-4">
              <h2 className="mb-4 text-sm font-semibold text-white">
                {editingCashoutId ? "Edit Redeem / Cashout Entry" : "Add Redeem / Cashout Entry"}
              </h2>
              <form onSubmit={addOrUpdateCashout} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">
                    Customer Facebook Name
                  </label>
                  <input
                    value={cashoutForm.customer_facebook_name}
                    onChange={(e) =>
                      setCashoutForm((f) => ({ ...f, customer_facebook_name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">Game</label>
                  <select
                    value={cashoutForm.game_code}
                    onChange={(e) =>
                      setCashoutForm((f) => ({ ...f, game_code: e.target.value as GameCode }))
                    }
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  >
                    {GAMES.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">Game Username</label>
                  <input
                    value={cashoutForm.game_username}
                    onChange={(e) =>
                      setCashoutForm((f) => ({ ...f, game_username: e.target.value }))
                    }
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">
                    Redeem / Cashout Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    required
                    value={cashoutForm.amount}
                    onChange={(e) => setCashoutForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">Payment Method</label>
                  <select
                    value={cashoutForm.payment_method}
                    onChange={(e) =>
                      setCashoutForm((f) => ({
                        ...f,
                        payment_method: e.target.value as PaymentMethod,
                      }))
                    }
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">
                    {PAYMENT_TAG_LABELS[cashoutForm.payment_method]}
                  </label>
                  <input
                    value={cashoutForm.payment_tag}
                    onChange={(e) => setCashoutForm((f) => ({ ...f, payment_tag: e.target.value }))}
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-emerald-200/80">
                    Facebook Page Requested From
                  </label>
                  <select
                    value={cashoutForm.page_source_id}
                    onChange={(e) =>
                      setCashoutForm((f) => ({ ...f, page_source_id: e.target.value }))
                    }
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  >
                    <option value="">None / Not applicable</option>
                    {pageSources.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.platform ? `${p.page_name} - ${p.platform}` : p.page_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="mb-1 block text-sm text-emerald-200/80">Notes</label>
                  <input
                    value={cashoutForm.notes}
                    onChange={(e) => setCashoutForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                  />
                </div>

                <div className="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-3">
                  {editingCashoutId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCashoutId(null);
                        setCashoutForm({ ...emptyCashoutForm });
                      }}
                      className="rounded-lg border border-panelborder px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-800/40"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {editingCashoutId ? "Update Entry" : "Add Entry"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Redeems added this shift */}
          <div className="card-panel p-4">
            <h2 className="mb-4 text-sm font-semibold text-white">Redeems Added This Shift</h2>
            {cashouts.length === 0 ? (
              <EmptyState message="No redeem/cashout entries added yet" hint="Use the form above to add redeems as customers cash out." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-emerald-200/50">
                      <th className="py-2 pr-3">Customer</th>
                      <th className="py-2 pr-3">Game</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Tag / Info</th>
                      <th className="py-2 pr-3">Page Source</th>
                      <th className="py-2 pr-3">Status</th>
                      {isEditable && <th className="py-2 pr-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panelborder">
                    {cashouts.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 pr-3 text-emerald-100">{c.customer_facebook_name || "—"}</td>
                        <td className="py-2 pr-3 text-emerald-100">{c.game_name}</td>
                        <td className="py-2 pr-3 font-semibold text-gold">${Number(c.amount).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-emerald-100/80">{c.payment_method}</td>
                        <td className="py-2 pr-3 text-emerald-100/80">{c.payment_tag || "—"}</td>
                        <td className="py-2 pr-3 text-emerald-100/80">{c.page_source_name || "—"}</td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={c.status} />
                        </td>
                        {isEditable && (
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditCashout(c)}
                                className="text-emerald-300/60 hover:text-gold"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => deleteCashout(c.id)}
                                className="text-emerald-300/60 hover:text-danger"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Save / Submit actions */}
          {isEditable && (
            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={saveDraft}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg border border-panelborder px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-800/40 disabled:opacity-50"
              >
                <Save size={16} />
                {editorRole === "manager" ? "Save Changes" : isSubmitted ? "Save Changes" : "Save Draft"}
              </button>
              <button
                onClick={submitShift}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
              >
                <Send size={16} />
                {editorRole === "manager"
                  ? "Save Status"
                  : isNeedsCorrection
                    ? "Resubmit Shift Report"
                    : isSubmitted
                      ? "Update Submitted Report"
                      : "Submit Shift Report"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
