# Game Cost Discrepancy — Root Cause & Plan of Action

Date: 2026-07-12 · Status: **PHASE 1 EXECUTED 2026-07-16** — Luis confirmed Formula A (game cost from positive game profit only, never from recharge, no scaling). All 6 views now use `reportTotalsFromStoredEntries` / `singleReportTotalsFromStoredEntries` in `src/lib/calculations.ts`; the scaled formula was deleted. Regression tests in `src/lib/calculations.test.ts`. Phases 2–3 (per-shop rates, edit-preserves-historical-rates) still pending Luis's answers in §4.

---

## 1. What's happening

The app calculates game cost in **two different ways depending on the page**. Five views use one formula; the Manager Dashboard uses another. When a shift report contains any losing game, the two formulas give different numbers — which is exactly the owner-vs-manager mismatch you're seeing.

### The two formulas in the code

**Formula A — "stored cost + zero-out"** (used by 5 views)
- Sums the per-entry `game_cost` saved in the database at submission time (`max(profit, 0) × rate`).
- If the whole report's profit ≤ 0, game cost = $0.
- No other adjustment.

Used by:
- Owner Dashboard (`src/components/owner/owner-report-content.tsx`, `totals()` line 147)
- Owner Reports (same component)
- Owner Shift Reports list (`src/app/owner/shift-reports/page.tsx` line 62)
- Manager 24-Hour Shop Report (`src/app/manager/shop-report/page.tsx` line 129)
- Manager Shift Reports list (`src/app/manager/shift-reports/page.tsx` line 71)

**Formula B — "recomputed + scaled"** (used by 1 view)
- Ignores the stored `game_cost`; regroups entries by game and recomputes cost from `game_cost_percentage`.
- Then **scales it down**: `game cost × (net profit ÷ sum of positive-game profits)` — `calculateReportTotalsFromGroupedGames()` in `src/lib/calculations.ts` line 180.

Used by:
- **Manager Dashboard KPI cards and per-report table** (`src/app/manager/page.tsx` lines 100, 155, via `aggregateAcrossReports`)

### Worked example (verified against the actual code)

One report: Juwa +$1,000 profit @ 15%, Fire Kirin −$400 profit @ 12%. Net profit $600.

| View | Game Cost | Effective rate on net profit |
|---|---|---|
| Owner Dashboard (Formula A) | **$150** | **25.0%** ← your ">20%" observation |
| Manager Dashboard (Formula B) | **$90** | 15.0% |

So this is not a data problem and not one shop's settings — it's two formulas disagreeing whenever a report has a losing game. The bigger the losses in a report, the bigger the gap.

### Why you see game costs "over 20%" on the owner side

Owner side charges the full fee on winning games ($150 on Juwa's $1,000), but net profit is dragged down by losers ($600). $150 ÷ $600 = 25%. No shop's *rate* is actually above 15% — the *effective rate on net profit* exceeds it.

### Secondary problems found during the audit

1. **Game cost rates are global, not per shop.** The `game_settings` table has no `shop_id`. Every shop uses the same rate per game. If shops actually pay different rates to distributors, the app can't represent that today.
2. **Editing a report silently rewrites history.** When a manager opens View/Edit and saves (`shift-report-client.tsx` line 360), all entries are rewritten with the *current* global rates — not the rates in effect when the shift was submitted. If you change a rate in Game Settings, every old report edited afterward gets recalculated with the new rate.
3. **Stale code comment risk:** `calculations.ts` assumes "never above 15%" as the max rate. Nothing enforces or breaks at >15%, but the scaling rule was designed around that assumption.

---

## 2. Decision needed (this is yours, Luis)

Which formula is the business truth?

**Recommended: Formula A (stored cost, no scaling).**
Why: each game distributor bills its own percentage on that game's positive profit. Juwa doesn't discount your bill because Fire Kirin lost money that day. Formula A matches what you actually owe. It's also what migration 0025 already enforces in the database, and 5 of 6 views already use it. The "25% effective rate" is real: fees eat a bigger share of profit on days with losing games. Hiding that (Formula B) understates cost and overstates true profit.

Alternative: Formula B everywhere (scaled) — only correct if your distributors genuinely net losses across games, which is not how these platforms bill.

**Everything below assumes Formula A. Say the word and I'll execute.**

---

## 3. Plan of action

### Phase 1 — Unify the formula (fixes the owner/manager mismatch)

1. Add one canonical function to `src/lib/calculations.ts`:
   `reportTotalsFromStoredEntries(entries)` → stored `game_cost` sum, per-report zero-out, no scaling.
2. Rewrite `src/app/manager/page.tsx` to use it (replace `aggregateAcrossReports` + `calculateReportTotalsFromGroupedGames` calls at lines 100 and 155).
3. Refactor the 5 Formula-A views to call the same shared function instead of their own inlined copies (they're currently 5 hand-rolled duplicates that happen to agree — that's how this bug was born).
4. Delete or clearly deprecate the scaling logic in `calculateReportTotalsFromGroupedGames` so it can't be reintroduced.
5. Keep `calculateGameRow` (employee live entry) as-is — it already matches Formula A per entry.

### Phase 2 — Per-shop game cost rates (enables shops with different/>15% rates)

1. New migration `0026_shop_game_settings.sql`:
   - Table `shop_game_settings (id, shop_id, game_code, cost_percentage, is_active, timestamps)`, unique on `(shop_id, game_code)`, RLS: owner writes, shop staff read own shop.
   - No rate cap — 20%+ allowed.
2. Rate resolution everywhere: `shop_game_settings` for the employee's shop → fallback to global `game_settings` → fallback to hardcoded defaults.
3. Owner UI: add a shop selector to `/owner/game-settings` to edit per-shop rates (global tab stays as the default/fallback).
4. Employee shift report + manager edit page load the shop-specific rates.

### Phase 3 — Protect historical financials

1. On manager edit, **preserve each entry's stored `game_cost_percentage`** instead of overwriting with current settings. Rate changes then apply only to future reports.
2. Optional one-time recompute of old rows only if you determine past rates were entered wrong. This changes financial totals, so it ships as a reviewed SQL script that runs **only with your explicit approval**, with a before/after backup like `backups/before-reconciliation-*.sql`.

### Phase 4 — Verify

1. Unit tests: one fixture (mixed winning/losing games, multiple reports, multiple shops) asserted to produce **identical** totals through the owner path, manager dashboard path, 24h report path, and both list paths.
2. Regression test for the worked example above ($150, never $90).
3. Manual check: pick one real day, compare Manager Dashboard vs Owner Dashboard vs 24h Report for the same shop — all three must match to the cent.

### Effort

Phase 1 is the actual bug fix (~4 files + tests). Phases 2–3 are the per-shop rates feature and audit protection. All reversible except the optional Phase 3 recompute, which waits for your approval.

---

## 4. What I need from you

1. Confirm **Formula A** (no scaling) is the business rule — or tell me distributors net losses across games and we go Formula B everywhere.
2. Confirm shops pay **different rates per game** (per-shop rates feature needed) — and roughly what the >20% shops pay.
3. Whether historical reports should be recomputed after rates are corrected (Phase 3, needs your explicit go).
