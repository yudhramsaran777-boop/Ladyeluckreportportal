# Lady E Luck Portal — Complete Master Guide

**Purpose:** Everything you need to understand the portal from scratch, how every section was built, what every piece of code does, and how to add new features like a social media approval system.

---

## Table of Contents

1. [What the Portal Is](#1-what-the-portal-is)
2. [Technology Stack — What We Use and Why](#2-technology-stack)
3. [Project Folder Structure](#3-project-folder-structure)
4. [The Database — Supabase & PostgreSQL](#4-the-database)
5. [Authentication — How Login Works](#5-authentication)
6. [The Three Roles — Employee, Manager, Owner](#6-the-three-roles)
7. [How the Employee Section Was Built](#7-employee-section)
8. [How the Manager Section Was Built](#8-manager-section)
9. [How the Owner Section Was Built](#9-owner-section)
10. [The Reporting System — How Numbers Are Calculated](#10-reporting-system)
11. [The CRUD System — How Add/Edit/Delete Works](#11-crud-system)
12. [The Payment System (Gmail Backend)](#12-payment-system)
13. [Design System — Colors, Cards, Layout](#13-design-system)
14. [How to Add a New Feature — Step-by-Step](#14-how-to-add-a-new-feature)
15. [Adding the Social Media Approval System](#15-social-media-approval-system)

---

## 1. What the Portal Is

The Lady E Luck Portal is a private staff management web application. It is used to:

- Track employee shifts (what games were played, how many coins were recharged and redeemed)
- Record customer cashouts (who won, how much, which game, payment method)
- Show managers their shop's daily performance
- Show the owner all shops' performance combined and individually
- Store game account credentials employees need for their shift
- Store payment account info (CashApp, Chime) employees need to pay out customers
- Keep Facebook page sources on record for tracking where customers come from

The entire app runs in a browser. There is no mobile app. It is designed to be mobile-friendly (responsive).

---

## 2. Technology Stack

### Next.js 14 (App Router)
**What it is:** A React framework that lets you build web apps with both server-side and client-side code in one project.

**Why we use it:** It lets pages load fast (server renders the data before sending it to the browser), handles routing automatically by folder structure, and works perfectly with Supabase Auth.

**Key concept — Server vs. Client components:**
- Files with `"use server"` or no directive at the top = run on the server. They can read the database directly.
- Files with `"use client"` at the top = run in the browser. They handle user interaction (clicking buttons, typing forms).
- Most pages load data on the server, then pass it to a client component for interactivity.

### TypeScript
**What it is:** JavaScript with type checking. You declare what shape data has (`interface Profile { id: string; role: string }`) and the compiler catches mistakes before they become bugs.

**Why we use it:** Prevents bugs from typos and wrong data shapes. The `types.ts` file defines all the data shapes used across the app.

### Tailwind CSS
**What it is:** A utility-first CSS framework. Instead of writing CSS files, you add class names directly in your HTML/JSX like `className="text-sm font-bold text-white"`.

**Why we use it:** Fast to build, easy to read, no naming CSS classes, mobile responsive with `md:` and `xl:` prefixes.

**Our custom colors (in tailwind.config.ts):**
- `emerald-950` = `#04140f` — the darkest background
- `gold` = `#d4af37` — the gold accent color
- `panel` = `#0b2419` — the card background
- `panelborder` = `#1f4536` — the card border color
- `positive` = `#34d399` — green for profit
- `warning` = `#f59e0b` — amber for redeems/cashouts
- `danger` = `#f87171` — red for losses/errors

### Supabase
**What it is:** An open-source backend service built on PostgreSQL. It gives you a database, authentication (login system), file storage, and an auto-generated API — all without building a backend server from scratch.

**Why we use it:** It handles all user sessions, passwords, tokens, and database queries securely. Row Level Security (RLS) means Supabase enforces who can see what data at the database level — even if someone hacks around the UI.

**The two Supabase clients:**
- `src/lib/supabase/client.ts` — runs in the browser, uses the anonymous key, subject to RLS
- `src/lib/supabase/server.ts` — runs on the server, uses the anonymous key + the logged-in user's session cookies
- `src/lib/supabase/admin.ts` — uses the SERVICE ROLE key, bypasses RLS entirely (only used for owner creating users)

### Recharts
A React charting library. Used for the bar charts (Top Games by Recharge) and donut charts (Payment Distribution) on dashboards.

### Lucide React
An icon library. Every icon in the sidebar and cards (like `DollarSign`, `Users`, `Gamepad2`) comes from here.

---

## 3. Project Folder Structure

```
src/
  app/                     ← All pages live here (Next.js App Router)
    login/page.tsx         ← Login page
    signup/page.tsx        ← Signup page (not used by staff — owner creates accounts)
    dashboard/page.tsx     ← Smart redirect: sends user to /owner, /manager, or /employee
    
    employee/              ← Everything the employee can access
      layout.tsx           ← Guards the route (must be logged in + employee role)
      page.tsx             ← Employee dashboard
      shift-report/page.tsx
      my-reports/page.tsx
      cashouts/page.tsx
      game-logins/page.tsx
      payment-info/page.tsx
      rules/page.tsx
    
    manager/               ← Everything the manager can access
      layout.tsx           ← Guards the route (must be logged in + manager role)
      page.tsx             ← Manager dashboard
      shift-reports/page.tsx
      shift-reports/[reportId]/page.tsx  ← View one specific report
      cashouts/page.tsx
      employees/page.tsx
      game-accounts/page.tsx
      payment-accounts/page.tsx
      page-sources/page.tsx
      shop-report/page.tsx
      settings/page.tsx
    
    owner/                 ← Everything the owner can access
      layout.tsx           ← Guards the route (must be logged in + owner role)
      page.tsx             ← Owner dashboard
      shops/page.tsx
      managers/page.tsx
      employees/page.tsx
      shift-reports/page.tsx
      cashouts/page.tsx
      payment-accounts/page.tsx
      game-accounts/page.tsx
      game-settings/page.tsx
      page-sources/page.tsx
      reports/page.tsx
      settings/page.tsx
    
    api/                   ← API routes (server-side endpoints)
      gmail/               ← Gmail OAuth for the payment system
      payment-dashboard/   ← Payment dashboard token system
    
    globals.css            ← Global CSS (body color, card-panel class, sidebar-gradient)
    layout.tsx             ← Root layout (wraps everything with fonts, metadata)

  components/              ← Reusable UI pieces
    dashboard-shell.tsx    ← The main layout wrapper (sidebar + main content area)
    sidebar.tsx            ← Navigation sidebar (different links per role)
    header.tsx             ← Top bar header
    kpi-card.tsx           ← The metric boxes (Total Recharge, Total Profit, etc.)
    page-header.tsx        ← Page title bar
    status-badge.tsx       ← Colored pill showing active/inactive/draft/submitted
    empty-state.tsx        ← "No data yet" placeholder
    payment-carousel.tsx   ← Swipeable payment account cards for employees
    profile-settings-form.tsx

    employee/              ← Components only the employee view uses
      shift-report-client.tsx  ← The full shift entry form (biggest component)
      game-login-card.tsx
      game-logins-section.tsx
      payment-info-section.tsx

    manager/
      date-range-filter.tsx   ← Start/end date picker for dashboard filters

    owner/
      owner-report-content.tsx  ← The full owner dashboard content

    crud/                  ← Generic add/edit/delete system
      crud-page-client.tsx     ← The main CRUD table with action buttons
      record-form-modal.tsx    ← The modal form for add/edit
      add-user-modal.tsx       ← Special modal just for creating users
      user-assignment-table.tsx
      types.ts                 ← ColumnConfig, FieldConfig interfaces

    charts/
      top-games-bar-chart.tsx
      profit-line-chart.tsx
      payment-donut-chart.tsx

  lib/                     ← Shared logic and utilities
    types.ts               ← All TypeScript interfaces (Profile, Shop, ShiftReport, etc.)
    constants.ts           ← Game list, payment methods, shift intervals, role types
    calculations.ts        ← All profit/cost math formulas
    admin-actions.ts       ← Server Action: owner creates user accounts
    supabase/
      client.ts            ← Browser Supabase client
      server.ts            ← Server Supabase client
      admin.ts             ← Admin (service role) Supabase client
    payment/               ← Gmail payment ingestion system

  middleware.ts            ← Route protection (redirects to login if not authenticated)

supabase/
  migrations/              ← SQL files that build and update the database
    0001_init.sql          ← The original full schema (tables + RLS + seed data)
    0002 through 0024...   ← Each migration adds/changes something

docs/                      ← Documentation
```

---

## 4. The Database

The database is PostgreSQL hosted on Supabase. Everything is in the `public` schema.

### Tables (in plain English)

**`profiles`** — One row per user. Tied to Supabase Auth.
- `id` — same UUID as the Supabase Auth user
- `email`, `full_name`
- `role` — either `'owner'`, `'manager'`, or `'employee'`
- `shop_id` — which shop this person belongs to (null for the owner)
- `is_active` — if false, they can't log in

**`shops`** — Each physical gaming location.
- `name`, `status` (active/inactive), `notes`

**`shop_members`** — Links users to shops with a role. (Secondary record; `profiles.shop_id` is the primary link.)

**`game_settings`** — The games available and their cost percentages.
- `game_code` (JW, FK, MW, etc.), `game_name`, `cost_percentage`
- Readable by all authenticated users. Only the owner can edit.

**`payment_accounts`** — CashApp and Chime accounts per shop.
- `shop_id`, `payment_type` (CashApp/Chime), `tag`, `email`, `password`, `image_url`, `payment_link`, `status`

**`game_accounts`** — Game login credentials per shop.
- `shop_id`, `game_code`, `game_name`, `game_link`, `admin_link`, `username`, `password`, `vendor`, `admin_name`, `status`

**`page_sources`** — Facebook pages that customers come from.
- `shop_id`, `page_name`, `platform`, `page_url`, `status`

**`shift_reports`** — One report per employee per shift.
- `shop_id`, `employee_id`, `employee_name`, `shift_date`, `shift_interval`
- `status` — `draft` (being filled out), `submitted` (employee finished), `reviewed` (manager confirmed)

**`shift_game_entries`** — One row per game per shift report.
- Coins: `opening_coins_before_add`, `admin_added_coins`, `starting_coins_after_add`, `redeem_coins`, `ending_coins`
- Results: `normal_coin_difference`, `real_recharge`, `redeem_amount`, `game_cost_percentage`, `game_cost`, `gross_profit`, `true_profit`

**`shift_cashouts`** — Each customer cashout logged during a shift.
- `customer_facebook_name`, `game_code`, `game_username`, `amount`, `payment_method`, `payment_tag`, `page_source_id`, `status`

**`audit_logs`** — Owner-only log of actions.

### Row Level Security (RLS)

RLS means the database itself enforces who can see what. Even if someone calls the Supabase API directly, they only get their allowed rows.

**How it works:**
1. When a request hits Supabase, it knows the logged-in user's ID via `auth.uid()`.
2. It runs helper functions to check the user's role:
   - `public.is_owner()` — returns true if `profiles.role = 'owner'`
   - `public.is_manager()` — returns true if `profiles.role = 'manager'`
   - `public.current_shop_id()` — returns the user's `shop_id`
3. Each table has policies like:
   - `shift_reports_select`: You can see a report if you're the owner, OR your shop matches, OR you're the employee who submitted it.

**Security definer functions:** The helper functions are marked `security definer`, meaning they run as the database owner (not the user), which prevents RLS infinite loops when checking the `profiles` table.

### How the First User Becomes Owner

When anyone signs up, a PostgreSQL trigger (`on_auth_user_created`) fires automatically. It counts existing profiles. If there are 0, the new user gets `role = 'owner'`. If there are already users, they get `role = 'employee'`. This means the very first account created is always the owner.

### Migrations

Each file in `supabase/migrations/` is a numbered SQL script. They run in order and build up the database incrementally. Examples:
- `0001_init.sql` — Created all tables, RLS, triggers, and seed data (game list)
- `0003_shift_status_flow.sql` — Added the draft/submitted/reviewed status flow
- `0012_fix_negative_profit_game_cost.sql` — Fixed the formula so negative-profit shifts don't charge a game fee
- `0024_gmail_payment_backend.sql` — Added tables for the Gmail payment ingestion system

---

## 5. Authentication

### How Login Works

1. User goes to `/login` — a client-side page (`"use client"`)
2. They type email + password and click Sign In
3. The page calls `supabase.auth.signInWithPassword({ email, password })`
4. Supabase validates credentials and sets a session cookie in the browser
5. On success, the user is redirected to `/dashboard`

### How `/dashboard` Redirects

`src/app/dashboard/page.tsx` is a server component. It:
1. Reads the session from the cookie using `supabase.auth.getUser()`
2. Queries `profiles` to get the user's `role` and `is_active`
3. If inactive → shows an error message
4. If role is `owner` → `redirect("/owner")`
5. If role is `manager` → `redirect("/manager")`
6. If role is `employee` → `redirect("/employee")`

### How Route Protection Works (middleware.ts)

`src/middleware.ts` runs on every page request before the page loads. It checks:
- Is the requested path a protected path? (`/dashboard`, `/owner/*`, `/manager/*`, `/employee/*`)
- Is the user logged in?
- If not logged in + protected path → redirect to `/login?next=/original-path`

This is the first line of defense. The layout files add a second check.

### How Each Section's Layout Guards Its Role

Every section has a `layout.tsx` file. For example, `src/app/owner/layout.tsx`:
1. Gets the current user from Supabase
2. Queries their profile for `role`
3. If `role !== 'owner'` → `redirect("/dashboard")` (which re-routes them correctly)
4. If all checks pass → renders the `DashboardShell` with the sidebar and the page content

This means even if someone types `/owner` in the URL, they'll be bounced out if they're not the owner.

---

## 6. The Three Roles

### Role: Employee

**What they can see:** Their own shifts, their shop's game logins, payment info, cashout history, and house rules.

**What they can do:**
- Start a shift report (creates a `shift_reports` row in `draft` status)
- Add game entries (coins at start, coins added, coins at end)
- Log cashouts (who won, how much, which payment method)
- Submit the report (changes status to `submitted`)
- View their past reports

**What they cannot do:** See other employees' data, see financial totals, edit anything after submission (unless the manager unlocks it), manage accounts.

### Role: Manager

**What they can see:** Their shop only. All employees in their shop, all shift reports for their shop, payment accounts, game accounts, page sources.

**What they can do:**
- Everything the employee can do
- View and edit all shift reports for their shop
- Approve/mark cashouts as reviewed
- Add/edit payment accounts, game accounts, page sources
- Add employees to their shop
- See their shop's financial KPI dashboard with date range filter

**What they cannot do:** See other shops' data, change game cost percentages, create manager accounts, see the owner dashboard.

### Role: Owner

**What they can see:** Everything across all shops.

**What they can do:**
- Everything the manager can do
- Create/manage shops
- Create manager and employee accounts
- Set game cost percentages
- See the combined owner dashboard (all shops in one view + per-shop breakdown)
- See detailed shift reports and cashouts across all shops

---

## 7. Employee Section

### Files

```
src/app/employee/layout.tsx           ← Role guard
src/app/employee/page.tsx             ← Dashboard (payment info + game logins + shift form)
src/app/employee/shift-report/page.tsx
src/app/employee/my-reports/page.tsx
src/app/employee/cashouts/page.tsx
src/app/employee/game-logins/page.tsx
src/app/employee/payment-info/page.tsx
src/app/employee/rules/page.tsx

src/components/employee/shift-report-client.tsx   ← The main shift form
src/components/employee/payment-info-section.tsx
src/components/employee/game-logins-section.tsx
src/components/employee/game-login-card.tsx
```

### How the Shift Report Works

The shift report is the most complex part of the entire app. It lives in `shift-report-client.tsx` which is a `"use client"` component.

**Step 1: Load existing draft**
When the employee opens their dashboard, the server page checks if they have a `draft` shift report in the database. If yes, it loads all the game entries and cashouts already saved. These are passed as `initialReport`, `initialEntries`, `initialCashouts` props.

**Step 2: The employee fills in coins**
For each game, the employee enters:
- Opening Coins Before Add (what the game showed when they started)
- Admin Added Coins (how many coins the admin put in)
- Ending Coins (what the game showed at the end of shift)
- Redeem Coins (how many coins were given out as cashouts)

The component uses `calculateGameRow()` from `lib/calculations.ts` to instantly compute all derived values as the employee types.

**Step 3: Auto-save to draft**
Every time the employee clicks "Save Draft", the component calls Supabase to:
- `upsert` the `shift_reports` row (create or update)
- Delete old `shift_game_entries` for this report
- Re-insert all current entries

**Step 4: Logging cashouts**
Separately, the employee can add cashout rows with customer name, game, amount, payment method, tag, and page source.

**Step 5: Submit**
When the employee clicks "Submit Report", the status changes to `submitted`. After submission, the form becomes read-only.

### Payment Info Section

`payment-info-section.tsx` fetches all `payment_accounts` for the employee's shop and shows them in a carousel (`payment-carousel.tsx`). This lets employees see the CashApp and Chime account info they need to send money to customers.

### Game Logins Section

`game-logins-section.tsx` fetches all `game_accounts` for the employee's shop and shows login credentials (username, password, links) so employees can access the games.

---

## 8. Manager Section

### Files

```
src/app/manager/layout.tsx
src/app/manager/page.tsx              ← Dashboard with KPIs + date filter + reports table
src/app/manager/shift-reports/page.tsx
src/app/manager/shift-reports/[reportId]/page.tsx  ← View/edit one report
src/app/manager/cashouts/page.tsx
src/app/manager/employees/page.tsx
src/app/manager/game-accounts/page.tsx
src/app/manager/payment-accounts/page.tsx
src/app/manager/page-sources/page.tsx
src/app/manager/shop-report/page.tsx
src/app/manager/settings/page.tsx

src/components/manager/date-range-filter.tsx
```

### How the Manager Dashboard Works

`src/app/manager/page.tsx` is a server component that:
1. Gets the manager's `shop_id` from their profile
2. Reads `searchParams` (URL query params like `?start=2026-07-01&end=2026-07-01`) for the date filter
3. Queries `shift_reports` for that shop + date range
4. Gets all `shift_game_entries` and `shift_cashouts` for those reports
5. Calls `calculateGroupedGameTotals()` and `calculateReportTotalsFromGroupedGames()` to compute KPI numbers
6. Renders KPI cards, a bar chart of top games, a top winners table, and the reports table

### Date Range Filter

`date-range-filter.tsx` is a client component. When the manager changes the dates and clicks Apply, it pushes new URL query params (`router.push('/manager?start=...&end=...')`). Next.js re-renders the server page with the new dates.

### The [reportId] Dynamic Route

`/manager/shift-reports/[reportId]` is a dynamic page. The `[reportId]` in the folder name is replaced with the actual UUID. This lets managers click on any report and see/edit its full details. The `ShiftReportClient` component is reused here with `editorRole="manager"` so managers can unlock and edit submitted reports.

### CRUD Pages (employees, game-accounts, etc.)

Most manager pages use the generic `CrudPageClient` component. The page just defines what columns and fields to show, then passes data to `CrudPageClient` which handles displaying, adding, editing, and deleting records.

---

## 9. Owner Section

### Files

```
src/app/owner/layout.tsx
src/app/owner/page.tsx                    ← Owner dashboard
src/app/owner/shops/page.tsx
src/app/owner/managers/page.tsx
src/app/owner/employees/page.tsx
src/app/owner/shift-reports/page.tsx
src/app/owner/cashouts/page.tsx
src/app/owner/payment-accounts/page.tsx
src/app/owner/game-accounts/page.tsx
src/app/owner/game-settings/page.tsx
src/app/owner/page-sources/page.tsx
src/app/owner/reports/page.tsx
src/app/owner/settings/page.tsx

src/components/owner/owner-report-content.tsx  ← The full owner dashboard logic
src/lib/admin-actions.ts                        ← Server Action for creating users
```

### How the Owner Dashboard Works

The owner dashboard shows TWO levels of data:

**Global level** (all shops combined):
- Total Recharge, Total Cashout, Total Game Cost, Total Profit, Total True Profit, Total Cashouts, Active Shops, Active Payment Accounts
- Top Performing Shops table (ranked by True Profit)
- Global Payment Account Distribution (donut chart)
- Global Top Games by Recharge (bar chart)

**Per-shop level** (looped for each shop):
- Each shop gets its own `ShopSection` card
- Same KPI breakdown, but scoped to that shop's data only

This is all in `owner-report-content.tsx`, which is a server component imported into `owner/page.tsx`.

### How the Owner Creates Users

Creating users is handled differently because it requires the Supabase Admin API (service role key) which cannot be exposed to the browser.

**The flow:**
1. Owner goes to `/owner/employees` or `/owner/managers`
2. Clicks "Add Employee/Manager"
3. A modal (`add-user-modal.tsx`) collects email, password, name, role, shop
4. On submit, it calls `createUserByOwner()` from `src/lib/admin-actions.ts`
5. `createUserByOwner` is marked `"use server"` — a Next.js Server Action. It runs on the server.
6. It first verifies the caller is actually an owner (security check)
7. Then uses `createAdminClient()` (service role key) to call `supabase.auth.admin.createUser()`
8. Then upserts the `profiles` row with the correct role and shop
9. Then creates a `shop_members` row if a shop was assigned

### How Shops Are Created

The owner goes to `/owner/shops`. This page uses `CrudPageClient` with the `table="shops"` setting. When the owner fills in the form and saves, the client calls `supabase.from('shops').insert()`. Supabase RLS allows this because `is_owner()` returns true.

### Game Settings

`/owner/game-settings` lets the owner change the cost percentage for each game. These percentages are what get applied during shift report calculations. Employees can't change this — only the owner.

---

## 10. Reporting System

### The Core Formula

Everything revolves around this: **How much profit did the shop make from a game during a shift?**

**Coin flow:**
```
Opening Coins Before Add
+ Admin Added Coins
= Starting Coins After Add (auto-calculated, never manual)

Normal Coin Difference = Starting Coins After Add - Ending Coins
  → This is the gross profit (coins gained by the shop)

Real Recharge = Starting Coins After Add + Redeem Coins - Ending Coins
  → Total coins that customers actually paid for (including redeems)

Game Cost = max(Normal Coin Difference, 0) × Cost Percentage / 100
  → The fee paid to the game vendor. Only charged on positive games.
  → If a game lost money, no fee is owed.

True Profit = Normal Coin Difference - Game Cost
```

**Example:**
- Opening: 10,000 coins
- Admin Added: 5,000 coins
- Starting After Add: 15,000 coins
- Ending: 8,000 coins
- Redeem Coins: 2,000 coins
- Normal Coin Difference = 15,000 - 8,000 = 7,000 (shop gained 7,000 coins)
- Real Recharge = 15,000 + 2,000 - 8,000 = 9,000
- Game Cost = 7,000 × 12% = $840 (if Juwa 2 at 12%)
- True Profit = 7,000 - 840 = 6,160

**The negative-game rule:**
If a game lost money (Normal Coin Difference < 0), its Game Cost = 0. The shop owes nothing to the vendor on a losing game. This is critical for fair accounting across multiple games per shift.

**The report-level scaling rule:**
When some games win and some lose, the total Game Cost is scaled proportionally. This prevents situations where two games averaging out would still charge the full fee. The formula:

```
totalGameCost = sum(per-game costs) × (totalProfit / sumPositiveProfits)
```

This keeps the effective fee rate ≤ the highest single game rate (15%).

**Where the formulas live:**
`src/lib/calculations.ts` contains ALL the math. This file is imported anywhere numbers need to be computed — both on the server (reports) and in the browser (live calculation while employee types).

### How Reports Aggregate

**Single report** (`calculateReportTotals`): Groups entries by game, applies per-game rules, then applies report-level scaling.

**Date range / multiple reports** (`aggregateAcrossReports`): Applies `calculateReportTotals` to EACH report separately, then sums the results. This is critical — you can't just sum all entries and apply the formula once, because each report is its own profit period.

---

## 11. CRUD System

Many pages in the portal are just tables where you can add, edit, and delete records. Rather than writing a separate form and table for every page, we built a generic CRUD system.

### How It Works

A page defines two things:
1. `columns: ColumnConfig[]` — what to show in the table
2. `fields: FieldConfig[]` — what fields appear in the add/edit modal

Then it passes those + the current data to `<CrudPageClient>`.

**Example (Shops page):**
```typescript
const fields: FieldConfig[] = [
  { name: "name", label: "Shop Name", type: "text", required: true },
  { name: "status", label: "Status", type: "toggle-status" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const columns: ColumnConfig[] = [
  { key: "name", label: "Shop Name" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];
```

`CrudPageClient` renders:
- A table with those columns and an Edit + Delete button per row
- An "Add" button that opens `RecordFormModal`
- The modal renders form inputs based on `field.type` (text, textarea, toggle-status, select, etc.)
- On save, it calls `supabase.from(table).insert()` or `.update()`
- On delete, it calls `.delete()`

**Field types supported:**
- `text` — regular text input
- `textarea` — multi-line text
- `toggle-status` — active/inactive switch
- `select` — dropdown
- `password` — masked input
- `url` — URL input

---

## 12. Payment System (Gmail Backend)

This is a more advanced feature. The full documentation is in `docs/PAYMENT_SYSTEM_BLUEPRINT.md` and `docs/secure-gmail-payment-backend.md`.

**Summary:** The payment system connects to Gmail accounts (CashApp and Chime send payment confirmation emails). When payments come in, the system reads those emails, parses the transaction info, and stores it in the database. This helps track which payments match which cashouts.

The key files are in `src/lib/payment/` and the API routes at `src/app/api/gmail/` and `src/app/api/payment-dashboard/`.

---

## 13. Design System

### The Color Palette

Everything follows a dark green + black + gold casino aesthetic.

```css
/* Body background */
background: #04140f  (emerald-950)

/* Sidebar */
linear-gradient(180deg, #0d3a29 0%, #062017 60%, #03110c 100%)

/* Cards (.card-panel) */
background: #0b2419  border: 1px solid #1f4536

/* Gold accent */
#d4af37 (default)  #f4d27a (light)  #a8821f (dark)

/* Status colors */
positive = #34d399 (green)  warning = #f59e0b (amber)  danger = #f87171 (red)
```

### Key CSS Classes (in globals.css)

- `.card-panel` — The standard dark green card box used everywhere
- `.sidebar-gradient` — The dark sidebar background
- `.bg-app-gradient` — The radial gradient for the main background
- `.gold-underline` — Used on section headings; adds a gold line underneath

### Component Patterns

**KpiCard** (`kpi-card.tsx`): Takes `label`, `value`, `icon`, and optional `trend` + `trendDirection`. Used on all dashboards for the metric boxes.

**StatusBadge** (`status-badge.tsx`): Colored pill. `active` = green, `inactive` = gray, `draft` = amber, `submitted` = blue, `reviewed` = green.

**PageHeader** (`page-header.tsx`): Title bar at the top of each page.

**EmptyState** (`empty-state.tsx`): Centered message shown when a table has no rows.

---

## 14. How to Add a New Feature

Follow this checklist every time you add something new.

### Step 1: Design the data

Ask: What new data does this feature need? If it's new data, you need a database table.

Write a new migration file: `supabase/migrations/0025_your_feature_name.sql`

It should:
1. Create the table with all columns and foreign keys
2. Enable Row Level Security (`alter table ... enable row level security`)
3. Create RLS policies (who can select, insert, update, delete)
4. Add indexes on columns you'll filter by (shop_id, user_id, created_at)

Run it against your Supabase project via the SQL Editor or `supabase db push`.

### Step 2: Add TypeScript types

Add a new `interface` to `src/lib/types.ts` matching your new table's columns.

### Step 3: Decide what pages need it

- Owner-only? → Add to `src/app/owner/`
- Manager + Owner? → Add to both `src/app/manager/` and `src/app/owner/`
- Employee-visible? → Add to `src/app/employee/`

### Step 4: Create the page

For a simple list page (CRUD), copy the pattern from `src/app/owner/shops/page.tsx`:
1. Make it a server component (no `"use client"`)
2. Fetch data with `createClient()` from `@/lib/supabase/server`
3. Pass data to `<CrudPageClient>` with your columns and fields

For a complex page with its own UI:
1. Create the server page that fetches data
2. Pass it to a client component for interaction
3. The client component handles state and calls Supabase directly

### Step 5: Add the sidebar link

In `src/components/sidebar.tsx`, add your new page to the appropriate nav array:
```typescript
const OWNER_NAV: NavItem[] = [
  // ... existing items ...
  { label: "Social Media", href: "/owner/social-media", icon: Facebook },
];
```

### Step 6: Test RLS

Always test that:
1. An employee cannot access manager/owner data
2. A manager cannot see another shop's data
3. An owner can see everything

---

## 15. Adding the Social Media Approval System

Here is the complete plan for building a social media post planning and approval system inside the portal.

### What It Does

Staff (or the owner) submits social media posts for review. The owner approves, rejects, or requests changes. Approved posts can be tracked by scheduled date and platform.

### Database Migration

Create `supabase/migrations/0025_social_media_posts.sql`:

```sql
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_by_name text,
  platform text not null default 'Facebook',  -- Facebook, Instagram, TikTok, etc.
  caption text not null,
  hashtags text,
  image_url text,
  video_url text,
  scheduled_date date,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'needs_revision', 'posted')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  review_notes text,
  reviewed_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_social_posts_shop_id on public.social_posts(shop_id);
create index if not exists idx_social_posts_status on public.social_posts(status);
create index if not exists idx_social_posts_submitted_by on public.social_posts(submitted_by);
create index if not exists idx_social_posts_scheduled_date on public.social_posts(scheduled_date);

-- RLS
alter table public.social_posts enable row level security;

-- Owner can see everything
-- Manager can see their shop's posts
-- Employee can see posts they submitted
create policy "social_posts_select" on public.social_posts
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
    or submitted_by = auth.uid()
  );

-- Anyone authenticated can submit a post
create policy "social_posts_insert" on public.social_posts
  for insert with check (
    public.is_owner()
    or shop_id = public.current_shop_id()
    or submitted_by = auth.uid()
  );

-- Owner can update anything (approve/reject)
-- Manager can update their shop's posts
-- Employee can update their own pending posts
create policy "social_posts_update" on public.social_posts
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (submitted_by = auth.uid() and status = 'pending')
  );

-- Owner and manager can delete
create policy "social_posts_delete" on public.social_posts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
```

### TypeScript Type

Add to `src/lib/types.ts`:
```typescript
export interface SocialPost {
  id: string;
  shop_id: string | null;
  submitted_by: string | null;
  submitted_by_name: string | null;
  platform: string;
  caption: string;
  hashtags: string | null;
  image_url: string | null;
  video_url: string | null;
  scheduled_date: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision' | 'posted';
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Pages to Create

**Owner:**
- `/owner/social-media` — Sees ALL posts across all shops, can approve/reject/request revision

**Manager:**
- `/manager/social-media` — Sees their shop's posts, can submit and review

**Employee:**
- `/employee/social-media` — Can submit posts, see their own post statuses

### Status Flow

```
pending → approved → posted
pending → rejected
pending → needs_revision → pending (resubmitted)
```

### Sidebar Links

In `src/components/sidebar.tsx`:

```typescript
// Add to OWNER_NAV
{ label: "Social Media", href: "/owner/social-media", icon: Facebook },

// Add to MANAGER_NAV  
{ label: "Social Media", href: "/manager/social-media", icon: Facebook },

// Add to EMPLOYEE_NAV
{ label: "Social Media", href: "/employee/social-media", icon: Facebook },
```

### Key Design Decisions

1. **Status chip colors:** `pending` = amber, `approved` = green, `rejected` = red, `needs_revision` = orange, `posted` = blue
2. **The owner is the approver.** Managers can see and submit but cannot approve — only the owner can mark posts as approved or rejected.
3. **Review notes are required on rejection/needs_revision** so the submitter knows what to fix.
4. **Image upload** goes to a new Supabase Storage bucket called `social-post-images` (same pattern as `payment-account-images`).

---

## Quick Reference

| What you want to know | Where to look |
|---|---|
| All database tables | `supabase/migrations/0001_init.sql` |
| All TypeScript types | `src/lib/types.ts` |
| All games and their codes | `src/lib/constants.ts` |
| All profit math | `src/lib/calculations.ts` |
| How login works | `src/app/login/page.tsx` + `src/middleware.ts` |
| How roles redirect | `src/app/dashboard/page.tsx` |
| How owner creates users | `src/lib/admin-actions.ts` |
| How RLS helper functions work | Migration 0001 → HELPER FUNCTIONS section |
| How the sidebar is built | `src/components/sidebar.tsx` |
| How the shift form works | `src/components/employee/shift-report-client.tsx` |
| How the CRUD system works | `src/components/crud/crud-page-client.tsx` |
| How the owner dashboard works | `src/components/owner/owner-report-content.tsx` |
| How the manager dashboard works | `src/app/manager/page.tsx` |
| Color/style definitions | `tailwind.config.ts` + `src/app/globals.css` |
