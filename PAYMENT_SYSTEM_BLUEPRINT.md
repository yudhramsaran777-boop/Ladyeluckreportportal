# Lady E Luck Portal — Payment Activity System
# Repository Audit & Implementation Blueprint
# Phase 0 — READ-ONLY DELIVERABLE
# Generated: 2026-06-19

---

## A. CURRENT ARCHITECTURE SUMMARY

### Framework & Exact Package Versions
| Package | Version |
|---|---|
| next | 14.2.5 |
| react / react-dom | 18.3.1 |
| @supabase/supabase-js | 2.45.0 |
| @supabase/ssr | 0.4.0 |
| recharts | 2.12.7 |
| lucide-react | 0.414.0 |
| clsx | 2.1.1 |
| date-fns | 3.6.0 |
| typescript | 5.5.4 |
| tailwindcss | 3.4.7 |
| eslint | 8.57.0 |

### Routing Strategy
- **App Router only** — all routes live under `src/app/`
- No `pages/` directory exists
- Route segments: `/`, `/login`, `/signup`, `/dashboard`, `/employee/*`, `/manager/*`, `/owner/*`

### Component Model
- Layout files (`src/app/*/layout.tsx`) are **async Server Components** — perform auth and role checks
- Page files (`src/app/*/page.tsx`) are **async Server Components** — fetch data directly from Supabase server client
- Interactive components use `"use client"` directive
- No React Server Actions on forms yet — the CRUD system uses `"use client"` components that call the Supabase browser client directly

### UI Component Library
- **Fully custom** Tailwind-based design system
- No shadcn/ui, Radix UI, or Headless UI installed
- Custom CSS classes defined in `globals.css`: `.card-panel`, `.sidebar-gradient`, `.bg-app-gradient`, `.gold-underline`
- Custom Tailwind color tokens: `emerald-950/900/850/800/700`, `gold/gold-light/gold-dark`, `panel`, `panelborder`, `positive`, `warning`, `danger`

### Styling System
Tailwind CSS v3 with custom theme extension. All color tokens defined in `tailwind.config.ts`. Dark emerald-green palette with gold accents. Background `#04140f`, panel `#0b2419`, border `#1f4536`.

### Form Library
None — forms are vanilla React `useState` controlled inputs inside client components (`RecordFormModal`, `ShiftReportClient`, etc.)

### Validation Library
None — TypeScript types only; runtime validation is minimal (required field checks inside component submit handlers)

### State Management
Local `useState` only — no Zustand, Redux, Jotai, or Context beyond the `DashboardContext` (which provides `role`, `userName`, `userEmail`, `openMobileMenu`)

### Data Fetching Pattern
Server Components fetch data directly using `createClient()` from `@/lib/supabase/server`. No SWR, React Query, or custom hooks. Client Components call `createClient()` from `@/lib/supabase/client` for mutations and then call `router.refresh()` to re-run the server component.

---

## B. CURRENT EMPLOYEE DASHBOARD STRUCTURE

**Route:** `/employee`
**File:** `src/app/employee/page.tsx`
**Type:** Async Server Component with `export const dynamic = "force-dynamic"`

### Page rendering order (top to bottom):
1. `<PageHeader title="Employee Dashboard" showDateFilter={false} />`
2. Welcome card (`div.card-panel`) — contains:
   - `<h1>Welcome, {employeeName}</h1>`
   - `<p>Here is your dashboard...</p>`
   - Optional debug count line (CashApps / Chime / Games active)
3. `<PaymentInfoSection shopId={shopId} />` — renders Active CashApps + Active Chime Tags carousels
4. `<GameLoginsSection shopId={shopId} />` — renders active game accounts
5. `<ShiftReportClient ... />` — full interactive shift report form

### Data loaded on this page:
- `profiles` (id, full_name, shop_id)
- `payment_accounts` count (CashApp active)
- `payment_accounts` count (Chime active)
- `game_accounts` count (active)
- `game_settings` (all)
- `page_sources` (active, for shop)
- `shift_reports` (one draft, for employee)
- `shift_game_entries` (if draft exists)
- `shift_cashouts` (if draft exists)

---

## C. CURRENT PAYMENT INFO PAGE STRUCTURE

**Route:** `/employee/payment-info`
**File:** `src/app/employee/payment-info/page.tsx`
**Type:** Async Server Component

### Page rendering order (top to bottom):
1. `<PageHeader title="CashApp / Chime" showDateFilter={false} />`
2. Optional empty-state if no shop assigned
3. `<PaymentInfoSection shopId={shopId} />` — the **only content**

### PaymentInfoSection Component
**File:** `src/components/employee/payment-info-section.tsx`
**Type:** Async Server Component

Renders a 2-column grid:
- Left: `<PaymentCarousel title="Active CashApps" accounts={cashApps} />`
- Right: `<PaymentCarousel title="Active Chime Tags" accounts={chimes} />`

### PaymentCarousel Component
**File:** `src/components/payment-carousel.tsx`
**Type:** Client Component

A card with prev/next navigation showing one account at a time. Displays: payment type badge, QR image, tag (copy), email (copy), password (reveal/copy), payment link (copy/open), notes, download image button.

The `PaymentInfoSection` currently ends with the closing `</div>` of the 2-column grid. There is **no content below it** on the Payment Info page.

---

## D. CURRENT MANAGER DASHBOARD STRUCTURE

**Route:** `/manager`
**File:** `src/app/manager/page.tsx`
**Type:** Async Server Component with `export const dynamic = "force-dynamic"`

### Page rendering order (top to bottom):
1. `<PageHeader title="Daily Shop Overview - {shopName}" showDateFilter={false} />`
2. `<DateRangeFilter start={start} end={end} />` — date range picker card
3. KPI grid (7 cards): Shop Recharge, Shop Redeem, Shop Game Cost, Shop Profit, Shop True Profit, Cashouts Done, Active Payment Accounts
4. 2-column grid: Top Games by Real Recharge (bar chart) + Top Usernames That Won (table)
5. Recent Submitted Reports (full-width table with View/Edit links)

### Data loaded on this page:
- `profiles` (shop_id)
- `shops` (name)
- `payment_accounts` (id, payment_type, status) for count
- `shift_reports` (in date range)
- `shift_game_entries` (for those reports)
- `shift_cashouts` (for those reports)

---

## E. CURRENT MANAGER PAYMENT ACCOUNTS STRUCTURE

**Route:** `/manager/payment-accounts`
**File:** `src/app/manager/payment-accounts/page.tsx`
**Type:** Async Server Component

### Page rendering order (top to bottom):
1. `<PageHeader title="Payment Accounts" showDateFilter={false} />`
2. Empty state if no shop assigned
3. `<CrudPageClient table="payment_accounts" ... />` — renders as a **table layout** (not cards)

### CrudPageClient (table mode)
**File:** `src/components/crud/crud-page-client.tsx`
**Type:** Client Component

Structure:
- "Add Payment Account" button (top right)
- Overflow-x scrollable table with columns: Type (badge), Tag, Email, Payment Link, Image, Password (masked), Status (badge)
- Per-row Edit (pencil) and Delete (trash) action buttons
- `<RecordFormModal>` overlay for create/edit

### Current payment_accounts table fields visible in the form:
`payment_type`, `tag`, `email`, `password`, `image_url`, `payment_link`, `status`, `notes`

**There is no email association field for Gmail on the payment account form yet.** The existing `email` field is the account login email (CashApp/Chime account email), not a Gmail notification address.

---

## F. EXACT SAFE INSERTION POINT — Employee Welcome Section

In `src/app/employee/page.tsx`, the Welcome card is:

```tsx
<div className="card-panel p-4">
  <h1 className="text-lg font-semibold text-white">
    Welcome, {employeeName}
  </h1>
  <p className="mt-1 text-sm text-emerald-200/60">
    Here is your dashboard. Use the sidebar to navigate.
  </p>
  {shopId && (
    <p className="mt-1 text-xs text-emerald-200/40">
      CashApps: {debugCashAppCount} active · ...
    </p>
  )}
</div>
```

**LIVE PAYMENT ACTIVITY preview must be inserted as a NEW sibling `<div>` immediately after this Welcome card `</div>` and before `<PaymentInfoSection shopId={shopId} />`.**

The insertion point in code is the blank line between the closing `</div>` of the Welcome card and the `<PaymentInfoSection .../>` line.

The feature flag check must wrap it:
```tsx
{/* Welcome card — DO NOT MODIFY */}
<div className="card-panel p-4">...</div>

{/* NEW — only renders when flag is enabled */}
{paymentDashboardEnabled && (
  <LivePaymentActivityPreview shopId={shopId} />
)}

<PaymentInfoSection shopId={shopId} />
```

---

## G. EXACT SAFE INSERTION POINT — Active CashApps (Payment Info Page)

In `src/app/employee/payment-info/page.tsx`, the current page ends with `<PaymentInfoSection shopId={shopId} />`. Inside `PaymentInfoSection` (`src/components/employee/payment-info-section.tsx`), the component returns a `<div className="grid ...">` containing the two carousels.

**PAYMENT ACTIVITY section must be inserted as a NEW sibling element in `payment-info/page.tsx` AFTER `<PaymentInfoSection shopId={shopId} />`, NOT inside it.**

```tsx
<PaymentInfoSection shopId={shopId} />

{/* NEW — only renders when flag is enabled */}
{paymentDashboardEnabled && (
  <PaymentActivitySection shopId={shopId} />
)}
```

This keeps `PaymentInfoSection` completely untouched. `PaymentActivitySection` is the full feature component for the Payment Info page.

---

## H. EXACT SAFE INSERTION POINT — Manager Payment Overview

In `src/app/manager/page.tsx`, the final element is the "Recent Submitted Reports" `<div className="card-panel p-4">`. 

**Manager Payment Overview must be inserted as a NEW section AFTER the Recent Submitted Reports block and BEFORE the closing `</div>` of the root `<div className="space-y-6">`.**

```tsx
  {/* Existing: Recent Submitted Reports */}
  <div className="card-panel p-4">...</div>

  {/* NEW — manager-only, flag-gated */}
  {managerPaymentSummaryEnabled && (
    <ManagerPaymentOverview shopId={shopId} start={start} end={end} />
  )}
</div>
```

This placement is safe because it adds to the existing `space-y-6` vertical stack without disturbing any existing element positions or calculations.

---

## I. EXACT SAFE PLACEMENT — Connect Gmail Controls in Manager Payment Accounts

The Manager Payment Accounts page uses `CrudPageClient` which renders a table. The Gmail connection controls must **not** go inside `CrudPageClient` (it is a generic reusable component).

**Safest approach:** Add a new dedicated server component `<PaymentAccountGmailManager shopId={shopId} />` rendered in `src/app/manager/payment-accounts/page.tsx` **BELOW the `CrudPageClient`**:

```tsx
<CrudPageClient ... />

{/* NEW — flag-gated Gmail management section */}
{gmailSyncEnabled && (
  <PaymentAccountGmailManager shopId={shopId} />
)}
```

`PaymentAccountGmailManager` renders its own table/card list of payment accounts with Gmail status, using the same visual style (`.card-panel`, table layout) as `CrudPageClient`. This keeps the generic CRUD component completely untouched.

---

## J. EXISTING FILES THAT REQUIRE MINIMAL EDITS

| File | Edit Needed | Risk |
|---|---|---|
| `src/app/employee/page.tsx` | Insert `<LivePaymentActivityPreview>` after Welcome card, behind flag | Low — additive only |
| `src/app/employee/payment-info/page.tsx` | Insert `<PaymentActivitySection>` after `<PaymentInfoSection>`, behind flag | Low — additive only |
| `src/app/manager/page.tsx` | Insert `<ManagerPaymentOverview>` at bottom of space-y-6, behind flag | Low — additive only |
| `src/app/manager/payment-accounts/page.tsx` | Insert `<PaymentAccountGmailManager>` below `<CrudPageClient>`, behind flag | Low — additive only |
| `src/lib/types.ts` | Add new payment system TypeScript interfaces | Low — additive only |
| `src/components/status-badge.tsx` | Add new status keys for payment transaction and recharge statuses | Low — additive only |

---

## K. NEW FILES THAT SHOULD BE CREATED

### Server utilities
```
src/lib/supabase/payment-server.ts       — shop-authorized payment queries (server only)
src/lib/payment/feature-flags.ts         — server-side flag loader
src/lib/payment/gmail-crypto.ts          — AES-256-GCM encrypt/decrypt for tokens (server only)
src/lib/payment/gmail-oauth.ts           — Google OAuth helpers (server only)
src/lib/payment/gmail-history.ts         — Gmail history fetch and dedup (server only)
src/lib/payment/parsers/cashapp.ts       — Cash App email parser
src/lib/payment/parsers/chime.ts         — Chime email parser
src/lib/payment/sender-validator.ts      — Exact sender allowlist validation
src/lib/payment/recharge-calculator.ts   — bonus_given / missing_recharge formulas
src/lib/payment/payment-types.ts         — payment-specific TypeScript types
```

### API Route Handlers (new src/app/api/ directory)
```
src/app/api/gmail/callback/route.ts      — Google OAuth redirect handler
src/app/api/gmail/webhook/route.ts       — Gmail Pub/Sub push notification handler
src/app/api/payment/transactions/route.ts — Employee-safe paginated transaction list
src/app/api/payment/manager-summary/route.ts — Manager-only aggregate totals
```

### Server Actions
```
src/app/manager/payment-accounts/gmail-actions.ts  — connectGmail, disconnectGmail, testGmailConnection
src/app/employee/payment-info/payment-actions.ts   — addPlayerMapping, editPlayerMapping, createRecharge
```

### New Components
```
src/components/payment/                              — shared payment component directory
src/components/payment/payment-transaction-row.tsx  — shared transaction row (used in preview + full list)
src/components/payment/payment-transaction-table.tsx — scrollable table with filter bar
src/components/payment/payment-activity-filters.tsx — filter controls
src/components/payment/payment-status-badge.tsx     — extended status badge for payment statuses
src/components/payment/recharge-status-badge.tsx    — recharge-specific status badge
src/components/payment/add-player-panel.tsx         — slide-in drawer for player mapping
src/components/payment/recharge-player-dialog.tsx   — modal for recharge entry
src/components/payment/provider-badge.tsx           — CashApp / Chime visual badge
src/components/employee/live-payment-activity-preview.tsx — compact dashboard preview (5-8 rows)
src/components/employee/payment-activity-section.tsx — full Payment Info page section
src/components/manager/manager-payment-overview.tsx — manager KPI section
src/components/manager/payment-account-gmail-manager.tsx — Gmail controls per account
src/components/manager/gmail-connection-card.tsx    — per-account Gmail status + connect/disconnect
```

### Supabase Migrations
```
supabase/migrations/0014_payment_system_feature_flags.sql
supabase/migrations/0015_payment_system_schema.sql
supabase/migrations/0016_payment_system_rls.sql
supabase/migrations/0017_payment_system_indexes.sql
```

---

## L. PROPOSED SHARED COMPONENT STRUCTURE

The compact Dashboard preview and the full Payment Info section must share the same core row component to avoid duplication:

```
PaymentTransactionRow          — renders one transaction (shared)
  ↑ used by
  LivePaymentActivityPreview   — wraps 5-8 rows + "View All Payments" link
  PaymentActivitySection       — wraps full table with filters, pagination
```

Both `LivePaymentActivityPreview` and `PaymentActivitySection` are server components that fetch their own data through separate server-side functions (employee-safe query with no aggregate totals). They both render `<PaymentTransactionRow>` which is a client component for interactive actions (Add Player, Recharge).

`AddPlayerPanel` and `RechargePlayerDialog` are client components imported by `PaymentTransactionRow`. They receive read-only props from the server and make server action calls on submit.

---

## M. PROPOSED EMPLOYEE PAYMENT ACTIVITY UI

### Compact Dashboard Preview (LivePaymentActivityPreview)
Located directly below the Welcome card on `/employee`.

```
┌─ LIVE PAYMENT ACTIVITY ──────────────────────────────────────┐
│ 2:47 PM  CashApp  Business Name  $BusinessTag  $CustomerTag  │
│          CustomerName  → PlayerName  $20.00  ● confirmed     │
│          [Recharge Player]                                    │
│ ─────────────────────────────────────────────────────────────│
│ 2:31 PM  Chime   Business Name  BusinessTag   CustomerTag    │
│          CustomerName  → Unmatched  $50.00  ● confirmed      │
│          [Add Player]                                         │
│ ─────────────────────────────────────────────────────────────│
│ (up to 8 rows)                                               │
│                                                              │
│                           [ VIEW ALL PAYMENTS → ]            │
└──────────────────────────────────────────────────────────────┘
```

"VIEW ALL PAYMENTS" links to `/employee/payment-info#payment-activity`.

The server query for this preview selects ONLY the columns listed in section T. No totals. No aggregates.

### Full Payment Activity Section (PaymentActivitySection)
Located below Active CashApps/Chime on `/employee/payment-info`.

```
┌─ PAYMENT ACTIVITY ───────────────────────────────────────────┐
│ [CashApp|Chime] [Account ▾] [Received|Sent] [Status ▾]      │
│ [Matched|Unmatched] [Recharged|Not Recharged] [Date ▾]      │
│ [Search by tag or player...              🔍]                 │
│ ─────────────────────────────────────────────────────────────│
│ (transaction table — same rows as preview, paginated)        │
│ ─────────────────────────────────────────────────────────────│
│ [ Load More ]                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## N. PROPOSED EMPLOYEE PLAYER-MAPPING UI

### Add Player Side Panel (slide-in drawer from right)

**Trigger:** "Add Player" button beside an unmatched payment tag in a transaction row.

```
┌─ Add Player ──────────────────┐
│ READ-ONLY PAYMENT INFO         │
│ Provider:    CashApp           │
│ Account:     Business Name     │
│ Tag:         $CustomerTag      │
│ Customer:    John D.           │
│ Amount:      $20.00            │
│ Time:        2:47 PM           │
│ ───────────────────────────── │
│ PLAYER INFO                    │
│ Player Name  [_______________] │
│ Facebook     [_______________] │
│ Game User    [_______________] │
│ Primary Game [select ▾]        │
│ Note         [_______________] │
│                                │
│  [Cancel]  [Save Player]       │
└────────────────────────────────┘
```

On save, calls `addPlayerMapping` server action. The `shop_id`, `provider`, and normalized tag are set server-side and cannot be changed by the client.

### Mapping Status Flow
```
unmatched → employee_added → manager_verified
                           → needs_review → manager_verified
                                         → conflicting_match → manager_verified
employee_added → blocked (manager action only)
```

---

## O. PROPOSED EMPLOYEE RECHARGE PLAYER UI

### Recharge Player Dialog (modal overlay)

**Trigger:** "Recharge Player" button on a confirmed incoming transaction with a matched player.

```
┌─ Recharge Player ──────────────────────────────────────────┐
│ READ-ONLY PAYMENT                                           │
│ Provider:   CashApp  │  Account: Business Name             │
│ Tag:        $CustomerTag                                    │
│ Player:     PlayerName                                      │
│ Cash:       $30.00  ← locked, cannot be edited             │
│ Date/Time:  Jun 19 2026 2:47 PM                            │
│ ───────────────────────────────────────────────────────── │
│ RECHARGE ENTRY                                              │
│ Game        [select ▾]                                      │
│ Username    [_______________________]                       │
│ Coins       [_______________________]   ← employee types   │
│ Note        [_______________________]   ← optional         │
│ ───────────────────────────────────────────────────────── │
│ CALCULATED (live preview)                                   │
│ Cash Received:   $30.00                                     │
│ Coins Recharged: 30                                         │
│ Bonus Given:     $0.00   (max(coins - cash, 0))            │
│ Missing:         $0.00   (max(cash - coins, 0))            │
│ Status:          completed_no_bonus                         │
│                                                             │
│  [Cancel]  [Save Recharge]                                  │
└─────────────────────────────────────────────────────────────┘
```

The `cash_received` field is populated from the transaction `amount` and is read-only. The server action validates this against the stored transaction amount before saving.

### Recharge Status Values
| Coins vs Cash | bonus_given | missing_recharge | status |
|---|---|---|---|
| coins > cash | coins − cash | 0 | completed_with_bonus |
| coins = cash | 0 | 0 | completed_no_bonus |
| coins < cash | 0 | cash − coins | under_recharged |

Under-recharge sets status to `under_recharged` (maps to needs_review). A negative bonus is mathematically impossible — `bonus_given = GREATEST(coins − cash, 0)`.

---

## P. PROPOSED MANAGER PAYMENT OVERVIEW UI

Located at the bottom of `/manager` page, below "Recent Submitted Reports", flagged behind `manager_payment_summary_enabled`.

```
┌─ PAYMENT OVERVIEW ──── [date range inherits from page DateRangeFilter] ──┐
│  Total Received    Total Sent       Net Flow         Transactions         │
│  $X,XXX.00         $XXX.00          $X,XXX.00        XX                   │
│                                                                            │
│  CashApp Received  CashApp Sent     Chime Received   Chime Sent           │
│  $X,XXX.00         $XXX.00          $X,XXX.00        $XXX.00              │
│                                                                            │
│  Coins Recharged   Bonus Given      Missing Recharge  Needs Review        │
│  XX,XXX            $XXX.00          $XX.00            X transactions      │
│                                                                            │
│  Unmatched Tags    Gmail Errors                                            │
│  X tags            X errors                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

This section is fetched from a dedicated server-side query that verifies manager authorization before returning any aggregate. The data never passes through employee code paths.

---

## Q. PROPOSED MANAGER PAYMENT ACCOUNTS GMAIL UI

Below `CrudPageClient` on `/manager/payment-accounts`, in a new `PaymentAccountGmailManager` component. Uses the same `.card-panel` and table/card style.

### Not Connected State (per account row/card)
```
┌─ Business CashApp $BusinessTag ─────────────────────────────────┐
│  Type: CashApp  │  Tag: $BusinessTag  │  Status: ● active        │
│  Gmail: not configured                                            │
│  [ + Add Gmail Address ]                                          │
└──────────────────────────────────────────────────────────────────┘
```

### Gmail Address Added, Not Connected
```
│  Gmail: payments@gmail.com  ● Not Connected                       │
│  [ Connect Gmail ]                                                │
```

### Connected State
```
│  Gmail: payments@gmail.com  ● Connected                           │
│  Connected account: payments@gmail.com                            │
│  Last sync: 20 seconds ago  │  Watch expires: Jun 26             │
│  [ Test Connection ]  [ Reconnect ]  [ Disconnect ]               │
```

### Needs Attention State
```
│  Gmail: payments@gmail.com  ⚠ Needs Attention                     │
│  Reason: Authorization expired                                     │
│  [ Reconnect Gmail ]                                               │
```

---

## R. PROPOSED STRICT TYPESCRIPT TYPES

### New file: `src/lib/payment/payment-types.ts`

```typescript
export type PaymentProvider = 'CashApp' | 'Chime';
export type TransactionDirection = 'received' | 'sent';

export type TransactionStatus =
  | 'confirmed' | 'pending' | 'failed' | 'cancelled'
  | 'refunded' | 'reversed' | 'duplicate'
  | 'rejected_sender' | 'unknown_format' | 'needs_review';

export type PlayerMatchStatus =
  | 'unmatched' | 'matched' | 'conflicting' | 'blocked';

export type RechargeStatus =
  | 'completed_with_bonus' | 'completed_no_bonus'
  | 'under_recharged' | 'needs_review' | 'voided';

export type MappingVerificationStatus =
  | 'unmatched' | 'employee_added' | 'manager_verified'
  | 'needs_review' | 'conflicting_match' | 'blocked' | 'inactive';

export type GmailConnectionStatus =
  | 'not_connected' | 'connected' | 'needs_reconnect'
  | 'sync_error' | 'watch_expired' | 'disconnected';

export type SenderVerificationStatus =
  | 'pending_verification' | 'verified' | 'rejected' | 'inactive';

// Employee-safe transaction shape (no aggregate totals)
export interface EmployeePaymentTransaction {
  id: string;
  occurred_at: string;
  provider: PaymentProvider;
  payment_account_name: string;
  business_payment_tag: string | null;
  direction: TransactionDirection;
  individual_amount: number;
  customer_payment_tag: string | null;
  customer_name: string | null;
  player_name: string | null;
  game_username: string | null;
  transaction_status: TransactionStatus;
  player_match_status: PlayerMatchStatus;
  recharge_status: RechargeStatus | null;
  specific_recharge_bonus: number | null;
  specific_missing_recharge: number | null;
}

// Manager-only shape adds aggregate totals
export interface ManagerPaymentSummary {
  shop_id: string;
  period_start: string;
  period_end: string;
  total_received: number;
  total_sent: number;
  net_flow: number;
  cashapp_received: number;
  cashapp_sent: number;
  chime_received: number;
  chime_sent: number;
  total_coins_recharged: number;
  total_bonus_given: number;
  total_missing_recharge: number;
  transactions_needing_review: number;
  unmatched_tags: number;
  gmail_sync_errors: number;
}

export interface PlayerMapping {
  id: string;
  shop_id: string;
  provider: PaymentProvider;
  payment_tag: string;
  normalized_payment_tag: string;
  player_id: string | null;
  player_name: string | null;
  facebook_name: string | null;
  game_username: string | null;
  primary_game: string | null;
  internal_note: string | null;
  verification_status: MappingVerificationStatus;
  added_by: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RechargeRecord {
  id: string;
  shop_id: string;
  payment_transaction_id: string;
  employee_id: string;
  player_id: string | null;
  game_id: string | null;
  game_username: string | null;
  cash_received: number;       // immutable — from transaction
  coins_recharged: number;     // entered by employee
  bonus_given: number;         // calculated: GREATEST(coins - cash, 0)
  missing_recharge: number;    // calculated: GREATEST(cash - coins, 0)
  recharge_status: RechargeStatus;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlags {
  payment_dashboard_enabled: boolean;
  gmail_sync_enabled: boolean;
  manager_payment_summary_enabled: boolean;
}
```

---

## S. PROPOSED PROTECTED SERVER ENDPOINTS / SERVER ACTIONS

### API Route Handlers (new)

**`POST /api/gmail/callback`**
- Receives Google OAuth redirect
- Verifies `state` param contains authenticated manager's user ID and shop ID
- Calls Google token exchange
- Verifies authenticated Gmail address matches configured address on payment account
- Encrypts tokens using AES-256-GCM
- Stores in `gmail_connections` via service role client (never anon)
- Redirects to `/manager/payment-accounts` with status param

**`POST /api/gmail/webhook`**
- Receives Gmail Pub/Sub push notification
- Validates `X-Goog-Channel-Token` or subscription verification
- Finds the gmail_connection by matching the Gmail address in the notification
- Queues or directly calls history fetch + email processing
- Returns 200 immediately (Google requires fast acknowledgment)

**`GET /api/payment/transactions`**
- Requires valid Supabase session cookie
- Reads `shop_id` from the authenticated user's profile (server-side only)
- Accepts: `?limit`, `?cursor`, `?provider`, `?direction`, `?status`, `?player_match`, `?recharged`, `?search_tag`, `?search_player`, `?date_start`, `?date_end`
- Returns ONLY `EmployeePaymentTransaction[]` — no aggregate totals
- Response shape is validated before sending

**`GET /api/payment/manager-summary`**
- Requires valid session + manager or owner role
- Reads `shop_id` from profile (never from request body)
- Returns `ManagerPaymentSummary`

### Server Actions (new)

**`addPlayerMapping(transactionId, playerData)`** — `src/app/employee/payment-info/payment-actions.ts`
- Verifies employee's shop matches transaction's shop_id
- Normalizes payment tag
- Checks for existing mapping
- Inserts with `verification_status = 'employee_added'`
- Writes audit log

**`editPlayerMapping(mappingId, playerData)`**
- Verifies employee owns the mapping and it is not manager-verified
- Updates mapping
- Writes audit log

**`createRecharge(transactionId, rechargeData)`**
- Verifies employee's shop matches transaction's shop_id
- Reads `amount` from transaction (never trusts client-supplied amount)
- Calculates bonus_given and missing_recharge server-side
- Verifies transaction direction is 'received' and status is 'confirmed'
- Checks for existing non-voided recharge on same transaction
- Inserts recharge record
- Writes audit log

**`connectGmail(paymentAccountId)`** — `src/app/manager/payment-accounts/gmail-actions.ts`
- Verifies manager's shop_id matches payment account's shop_id
- Generates OAuth state token (signed, contains userId + accountId)
- Returns Google OAuth authorization URL

**`disconnectGmail(gmailConnectionId)`**
- Verifies manager authorization
- Sets connection_status = 'disconnected', clears tokens
- Writes audit log

**`testGmailConnection(gmailConnectionId)`**
- Verifies manager authorization
- Calls Gmail API with stored (decrypted) tokens
- Returns success/error status

---

## T. PROPOSED EMPLOYEE RESPONSE SHAPE

Server returns exactly these fields — nothing more:

```typescript
interface EmployeePaymentTransaction {
  id: string;
  occurred_at: string;           // ISO timestamp
  provider: 'CashApp' | 'Chime';
  payment_account_name: string;  // display name of business account
  business_payment_tag: string | null;
  direction: 'received' | 'sent';
  individual_amount: number;
  customer_payment_tag: string | null;
  customer_name: string | null;
  player_name: string | null;
  game_username: string | null;
  transaction_status: TransactionStatus;
  player_match_status: PlayerMatchStatus;
  recharge_status: RechargeStatus | null;
  specific_recharge_bonus: number | null;
  specific_missing_recharge: number | null;
  // Actionable flags (so UI knows what buttons to show)
  can_add_player: boolean;
  can_recharge: boolean;
  player_mapping_id: string | null;
  recharge_id: string | null;
}
```

**Explicitly excluded from employee response:**
`total_received`, `total_sent`, `net_flow`, `cashapp_total`, `chime_total`, `account_total`, `account_balance`, `shop_total`, `total_coins_recharged`, `total_bonus`, `gmail_address`, `oauth_token`, `encrypted_access_token`, `encrypted_refresh_token`

---

## U. PROPOSED MANAGER RESPONSE SHAPE

Manager summary is a separate query, separate endpoint, separate server component. It adds:

```typescript
interface ManagerPaymentSummary {
  shop_id: string;
  period_start: string;
  period_end: string;
  total_received: number;
  total_sent: number;
  net_flow: number;
  cashapp_received: number;
  cashapp_sent: number;
  chime_received: number;
  chime_sent: number;
  total_coins_recharged: number;
  total_bonus_given: number;
  total_missing_recharge: number;
  transactions_needing_review: number;
  unmatched_tags: number;
  gmail_sync_errors: number;
  // Never includes: oauth tokens, raw gmail message content, credentials
}
```

---

## V. PROPOSED DATABASE MIGRATIONS

### Migration 0014 — shop_feature_flags
```sql
create table if not exists public.shop_feature_flags (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  payment_dashboard_enabled boolean not null default false,
  gmail_sync_enabled boolean not null default false,
  manager_payment_summary_enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id)
);
```

### Migration 0015 — Full payment system schema

**gmail_connections** (OAuth tokens stored server-side only, never exposed via RLS to browser roles)
```sql
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  payment_account_id uuid references public.payment_accounts(id) on delete cascade,
  email_address text not null,
  -- encrypted_access_token and encrypted_refresh_token stored as text (AES-256-GCM, base64)
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  last_history_id text,
  watch_expires_at timestamptz,
  connection_status text not null default 'not_connected',
  last_sync_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  disconnected_by uuid references public.profiles(id) on delete set null,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**payment_email_senders** (owner-managed allowlist)
```sql
create table if not exists public.payment_email_senders (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  sender_email text not null,
  normalized_sender_email text not null,
  verification_status text not null default 'pending_verification',
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_sender_email)
);
-- Initial seed (is_active = false until verified):
-- INSERT pending_verification: cash@square.com (CashApp)
-- INSERT pending_verification: alers@account.chime.com (Chime — pending typo confirmation)
```

**payment_email_events** (every processed/rejected email)
```sql
create table if not exists public.payment_email_events (
  id uuid primary key default gen_random_uuid(),
  gmail_connection_id uuid references public.gmail_connections(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  gmail_message_id text not null,
  gmail_thread_id text,
  sender_email text,
  normalized_sender_email text,
  subject text,
  email_received_at timestamptz,
  sender_allowed boolean not null default false,
  authentication_status text,
  parse_status text,
  rejection_reason text,
  body_hash text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(gmail_message_id)
);
```

**payment_transactions**
```sql
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  email_event_id uuid references public.payment_email_events(id) on delete set null,
  provider text not null,
  provider_transaction_id text,
  direction text not null check (direction in ('received','sent')),
  amount numeric not null,
  customer_name text,
  customer_payment_tag text,
  normalized_customer_payment_tag text,
  status text not null default 'confirmed',
  is_counted boolean not null default false,
  occurred_at timestamptz not null,
  player_match_status text not null default 'unmatched',
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**player_payment_tags**
```sql
create table if not exists public.player_payment_tags (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  provider text not null,
  payment_tag text not null,
  normalized_payment_tag text not null,
  player_id uuid,
  player_name text,
  facebook_name text,
  game_username text,
  primary_game text,
  internal_note text,
  verification_status text not null default 'unmatched',
  status text not null default 'active',
  added_by uuid references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, provider, normalized_payment_tag)
);
```

**payment_recharges**
```sql
create table if not exists public.payment_recharges (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  employee_id uuid references public.profiles(id) on delete set null,
  player_id uuid,
  game_id uuid references public.games(id) on delete set null,
  game_username text,
  cash_received numeric not null,        -- copied from transaction.amount at insert time
  coins_recharged numeric not null,
  bonus_given numeric not null default 0,
  missing_recharge numeric not null default 0,
  recharge_status text not null,
  notes text,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**payment_audit_logs**
```sql
create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now()
);
```

**Add `payment_link` and `gmail_connection_id` to existing `payment_accounts`:**
```sql
-- payment_link already exists from migration 0005
alter table public.payment_accounts
  add column if not exists account_display_name text,
  add column if not exists gmail_connection_id uuid references public.gmail_connections(id) on delete set null,
  add column if not exists connection_status text not null default 'not_connected',
  add column if not exists last_synced_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
```

---

## W. PROPOSED RLS POLICIES

### shop_feature_flags
```sql
-- Owner can read/write all; manager and employee can read their own shop's flags
create policy "feature_flags_select" on public.shop_feature_flags
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );
create policy "feature_flags_owner_write" on public.shop_feature_flags
  for all using (public.is_owner());
```

### gmail_connections
```sql
-- CRITICAL: No browser role may ever read token columns.
-- RLS allows manager/owner to see metadata only.
-- Token columns (encrypted_access_token, encrypted_refresh_token) are
-- only readable via the service role key (server-side admin client).
create policy "gmail_connections_select" on public.gmail_connections
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
-- All writes go through server actions using the admin client. No browser insert/update/delete.
```

### payment_email_senders
```sql
-- Owner can manage; all authenticated users can read verified active senders
create policy "senders_select" on public.payment_email_senders
  for select using (auth.uid() is not null);
create policy "senders_owner_write" on public.payment_email_senders
  for all using (public.is_owner());
```

### payment_email_events
```sql
-- Manager and owner only — employees never see raw email events
create policy "email_events_select" on public.payment_email_events
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
-- No browser insert — server-side only via admin client
```

### payment_transactions
```sql
-- Employees can read confirmed, counted, non-rejected transactions for their shop only
create policy "transactions_employee_select" on public.payment_transactions
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      shop_id = public.current_shop_id()
      and status in ('confirmed', 'pending')
      and is_counted = true
    )
  );
-- No browser insert/update — server-side only via admin client
```

### player_payment_tags
```sql
-- Employees can read all mappings for their shop
create policy "player_tags_select" on public.player_payment_tags
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );
-- Employees can insert unverified mappings for their shop only
create policy "player_tags_employee_insert" on public.player_payment_tags
  for insert with check (
    shop_id = public.current_shop_id()
    and verification_status = 'employee_added'
  );
-- Employees can update only their own non-verified mappings
create policy "player_tags_employee_update" on public.player_payment_tags
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      added_by = auth.uid()
      and shop_id = public.current_shop_id()
      and verification_status not in ('manager_verified', 'blocked')
    )
  );
-- Only manager/owner can delete
create policy "player_tags_manager_delete" on public.player_payment_tags
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
```

### payment_recharges
```sql
-- Employees can read recharges for their shop
create policy "recharges_select" on public.payment_recharges
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );
-- Employees can insert recharges for their shop (server action enforces transaction validation)
create policy "recharges_employee_insert" on public.payment_recharges
  for insert with check (
    shop_id = public.current_shop_id()
    and employee_id = auth.uid()
  );
-- Void/update is manager/owner only
create policy "recharges_manager_update" on public.payment_recharges
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
```

### payment_audit_logs
```sql
-- Employees cannot read audit logs; manager can read their shop's audit logs
create policy "payment_audit_select" on public.payment_audit_logs
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );
create policy "payment_audit_insert" on public.payment_audit_logs
  for insert with check (auth.uid() is not null);
```

---

## X. PROPOSED FEATURE-FLAG DESIGN

### Server-side flag loader: `src/lib/payment/feature-flags.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export interface PaymentFeatureFlags {
  payment_dashboard_enabled: boolean;
  gmail_sync_enabled: boolean;
  manager_payment_summary_enabled: boolean;
}

export async function getPaymentFeatureFlags(shopId: string): Promise<PaymentFeatureFlags> {
  const supabase = createClient();
  const { data } = await supabase
    .from('shop_feature_flags')
    .select('payment_dashboard_enabled, gmail_sync_enabled, manager_payment_summary_enabled')
    .eq('shop_id', shopId)
    .maybeSingle();
  return {
    payment_dashboard_enabled: data?.payment_dashboard_enabled ?? false,
    gmail_sync_enabled: data?.gmail_sync_enabled ?? false,
    manager_payment_summary_enabled: data?.manager_payment_summary_enabled ?? false,
  };
}
```

### Usage in employee Dashboard page
```typescript
const flags = shopId ? await getPaymentFeatureFlags(shopId) : defaultFlags;
// Pass flag as prop to avoid extra Supabase calls
```

### When all flags are false
- Employee Dashboard renders exactly as today
- Employee Payment Info page renders exactly as today
- Manager Payment Accounts page renders exactly as today
- No new queries execute
- No Realtime subscriptions start
- No new navigation items appear

---

## Y. PROPOSED GMAIL OAUTH DESIGN

### Flow
1. Manager clicks "Connect Gmail" on a payment account row
2. Server action `connectGmail(paymentAccountId)` runs:
   - Reads authenticated user from session
   - Verifies `payment_accounts.shop_id = profile.shop_id`
   - Generates a signed HMAC state token: `{userId}:{accountId}:{nonce}` (signed with `GMAIL_OAUTH_STATE_SECRET`)
   - Returns Google OAuth URL with scopes: `gmail.readonly`, `gmail.labels`
3. Browser redirects to Google
4. Manager authenticates with Gmail
5. Google redirects to `/api/gmail/callback?code=...&state=...`
6. Callback route handler:
   - Verifies HMAC state signature
   - Extracts userId and accountId from state
   - Verifies the Supabase session matches userId
   - Calls Google token exchange (server-side)
   - Reads the authenticated Gmail address from Google's userinfo endpoint
   - Compares against `payment_accounts.email` (the configured Gmail address)
   - On match: encrypts tokens, stores in `gmail_connections`, sets `connection_status = 'connected'`
   - On mismatch: stores mismatch event for manager review, does not connect
   - Redirects to `/manager/payment-accounts?gmail=connected` (or `?gmail=mismatch`)

### Required environment variables (new)
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/gmail/callback
GMAIL_OAUTH_STATE_SECRET=...   (random 32-byte hex, for HMAC state signing)
PAYMENT_TOKEN_ENCRYPTION_KEY=...  (random 32-byte hex, for AES-256-GCM token encryption)
GMAIL_PUBSUB_TOPIC=projects/{project}/topics/{topic}
```

### Gmail Scopes Required
- `https://www.googleapis.com/auth/gmail.readonly` — read messages
- `https://www.googleapis.com/auth/gmail.labels` — manage watch

---

## Z. PROPOSED GMAIL TOKEN ENCRYPTION APPROACH

### `src/lib/payment/gmail-crypto.ts` (server-only)

Algorithm: **AES-256-GCM** with a per-encryption random 12-byte IV. The IV is stored prepended to the ciphertext (base64-encoded). The auth tag is appended. Only the Node.js `crypto` module is used — no third-party encryption packages needed.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY = Buffer.from(process.env.PAYMENT_TOKEN_ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
```

Tokens are stored encrypted in `gmail_connections.encrypted_access_token` and `gmail_connections.encrypted_refresh_token`. They are **never** returned by any API route, never read by RLS-accessible queries, and only decrypted server-side in the admin client context.

---

## AA. PROPOSED PUB/SUB AND GMAIL HISTORY SYNC DESIGN

### Gmail Watch Setup
After successful OAuth connection:
1. Call `gmail.users.watch({ userId: 'me', topicName: GMAIL_PUBSUB_TOPIC, labelIds: ['INBOX'] })`
2. Store `historyId` and `expiration` in `gmail_connections`
3. Schedule watch renewal 1 day before expiration (via a cron job or Vercel Cron)

### Pub/Sub Webhook Handler (`/api/gmail/webhook`)
```
POST /api/gmail/webhook
Body: { message: { data: base64({ emailAddress, historyId }) }, subscription: "..." }
```

Processing:
1. Validate the request is from Google (verify the Pub/Sub push subscription)
2. Decode the base64 `data` payload to extract `emailAddress` and `historyId`
3. Look up `gmail_connections` by `email_address` (using admin client, server-side only)
4. If not found or not active → return 200 (don't retry)
5. Fetch Gmail history since `last_history_id` using stored (decrypted) access token
6. For each new message in history:
   a. Check `payment_email_events.gmail_message_id` for duplicate
   b. Fetch full message from Gmail API
   c. Extract `From` header, parse actual sender address
   d. Validate sender against `payment_email_senders` allowlist (exact normalized match)
   e. If rejected: insert rejected `payment_email_events` record, continue
   f. If allowed: parse email body (Cash App or Chime parser)
   g. Insert `payment_email_events` record
   h. Insert `payment_transactions` record
   i. Trigger Realtime notification for the shop
7. Update `last_history_id` to the latest history ID from the response
8. Return 200

### Gmail Watch Renewal (Vercel Cron)
```
// vercel.json
{
  "crons": [{ "path": "/api/gmail/renew-watches", "schedule": "0 2 * * *" }]
}
```

Daily at 2 AM: find all `gmail_connections` where `watch_expires_at < now() + interval '2 days'`, renew watch, update `watch_expires_at`.

---

## AB. PROPOSED EXACT SENDER VALIDATION SYSTEM

### `src/lib/payment/sender-validator.ts`

```typescript
function normalizeSender(raw: string): string {
  // Extract address from "Display Name <email@domain.com>" format
  const match = raw.match(/<([^>]+)>/);
  const address = match ? match[1] : raw;
  return address.trim().toLowerCase();
}

export async function validateSender(
  rawFromHeader: string,
  adminClient: SupabaseClient
): Promise<{ allowed: boolean; provider: string | null; reason: string }> {
  const normalized = normalizeSender(rawFromHeader);
  
  const { data: sender } = await adminClient
    .from('payment_email_senders')
    .select('provider, verification_status, is_active')
    .eq('normalized_sender_email', normalized)  // exact match only
    .maybeSingle();
  
  if (!sender) return { allowed: false, provider: null, reason: 'sender_not_in_allowlist' };
  if (!sender.is_active) return { allowed: false, provider: null, reason: 'sender_inactive' };
  if (sender.verification_status !== 'verified') {
    return { allowed: false, provider: null, reason: 'sender_not_verified' };
  }
  return { allowed: true, provider: sender.provider, reason: 'ok' };
}
```

### Initial seed data (inserted in migration 0015)
```sql
insert into public.payment_email_senders (provider, sender_email, normalized_sender_email, verification_status, is_active)
values
  ('CashApp', 'cash@square.com', 'cash@square.com', 'verified', true),
  -- Chime sender below is PENDING — exact address needs confirmation from a real Chime email
  ('Chime', 'alers@account.chime.com', 'alers@account.chime.com', 'pending_verification', false);
```

The Chime sender is seeded as `pending_verification` and `is_active = false`. It will not process any emails until the owner sets it to `verified` and `is_active = true` after confirming the exact sender address from a real Chime payment notification email.

---

## AC. PROPOSED CASH APP PARSER DESIGN

### `src/lib/payment/parsers/cashapp.ts`

Cash App sends emails from `cash@square.com`. Email subjects and bodies follow two main patterns:

**Received pattern:** `"[Name] sent you $XX.XX"`
**Sent pattern:** `"You sent [Name] $XX.XX"` or `"You paid $XX.XX to [Name]"`

```typescript
export interface CashAppParsedPayment {
  direction: 'received' | 'sent';
  amount: number;
  customer_name: string | null;
  customer_payment_tag: string | null;  // $cashtag if present
  provider_transaction_id: string | null;
  occurred_at: Date | null;
  parse_confidence: 'high' | 'medium' | 'low';
}

export function parseCashAppEmail(subject: string, bodyText: string): CashAppParsedPayment | null {
  // 1. Try subject-line parsing first (most reliable)
  // Pattern: "$XX.XX" amount extraction
  // Pattern: "sent you" → received; "You sent" → sent
  // Pattern: "$CashTag" extraction from body
  // 2. Fall back to body parsing
  // 3. Extract transaction ID from body (Cash App includes note ID)
  // 4. Extract timestamp from email headers (not body)
  // Return null if confidence is too low (triggers unknown_format status)
}
```

Key parsing rules:
- Amount: match `\$[\d,]+\.?\d*` and parse as float (remove commas)
- Direction: subject contains "sent you" → received; "you sent" or "you paid" → sent
- Cashtag: match `\$[a-zA-Z][a-zA-Z0-9_-]{1,19}` from body (CashApp cashtags are 2-20 chars)
- Transaction ID: match `[A-Z0-9]{10,}` near "Transaction ID" label in body
- If amount cannot be parsed → return null → `unknown_format` status

---

## AD. PROPOSED CHIME PARSER DESIGN

### `src/lib/payment/parsers/chime.ts`

**IMPORTANT:** The Chime sender address `alers@account.chime.com` contains a probable typo (should be `alerts@account.chime.com`). This must be confirmed from a real Chime email before the sender is activated. The parser is written but the sender remains `pending_verification` until confirmed.

```typescript
export interface ChimeParsedPayment {
  direction: 'received' | 'sent';
  amount: number;
  customer_name: string | null;
  customer_payment_tag: string | null;
  provider_transaction_id: string | null;
  occurred_at: Date | null;
  parse_confidence: 'high' | 'medium' | 'low';
}

export function parseChimeEmail(subject: string, bodyText: string): ChimeParsedPayment | null {
  // Chime payment received: "You received $XX.XX from [Name]"
  // Chime payment sent: "You sent $XX.XX to [Name]"
  // Extract amount, direction, customer name
  // Chime does not always include a cashtag — customer_payment_tag may be null
  // Chime may include a unique transfer ID in the email
}
```

Both parsers must:
- Return `null` rather than guessing if critical fields are missing
- Never modify `amount` from the parsed value
- Never infer direction from anything other than the email content
- Be tested against real email samples before enabling `gmail_sync_enabled`

---

## AE. PROPOSED DUPLICATE PREVENTION DESIGN

### Layer 1 — Gmail message ID uniqueness
`payment_email_events` has `unique(gmail_message_id)`. Any attempt to insert the same Gmail message ID a second time will fail with a unique constraint violation. The webhook handler catches this and silently continues (not an error — just an already-processed notification).

### Layer 2 — Provider transaction ID uniqueness
When `provider_transaction_id` is extracted, a unique index prevents the same financial transaction from being counted twice even if it arrives via different Gmail message IDs (edge case: email forwarding, sync retry).

### Layer 3 — Body hash
`payment_email_events.body_hash` stores a SHA-256 hash of the sanitized email body text. During processing, if a new message has the same hash as an existing event for the same shop + provider, it is flagged as `duplicate` and not counted.

### Layer 4 — Amount + time + account dedup window
For transactions without a provider_transaction_id, apply a soft-dedup rule: if a transaction with the same `payment_account_id` + `direction` + `amount` + `occurred_at` (within ±60 seconds) already exists, mark the new record as `duplicate` and set `is_counted = false`.

### Layer 5 — Recharge double-submission prevention
`payment_recharges` server action checks for an existing non-voided recharge linked to the same `payment_transaction_id` before inserting. If found, it returns an error without inserting.

---

## AF. PROPOSED PLAYER PAYMENT-TAG MAPPING DESIGN

### Normalization function
```typescript
export function normalizePaymentTag(tag: string, provider: 'CashApp' | 'Chime'): string {
  let normalized = tag.trim().toLowerCase();
  if (provider === 'CashApp') {
    // Remove leading $ if present
    normalized = normalized.startsWith('$') ? normalized.slice(1) : normalized;
  }
  // Remove spaces, underscores, hyphens for consistency
  normalized = normalized.replace(/[\s_-]/g, '');
  return normalized;
}
// $AshleyPay → ashleypay
// ashleypay → ashleypay
// ASHLEYPAY → ashleypay
// $Ashley-Pay → ashleypay
```

### Auto-matching on new transaction
When a new `payment_transaction` is inserted, a PostgreSQL trigger (or server-side lookup) checks `player_payment_tags` for a matching `(shop_id, provider, normalized_customer_payment_tag)`. If found with `verification_status = 'manager_verified'` or `'employee_added'`, sets `player_match_status = 'matched'` on the transaction and records the mapping.

### Mapping lifecycle
- New unmapped tag → `player_match_status = 'unmatched'` on transaction
- Employee adds player → mapping created with `verification_status = 'employee_added'`; all future transactions from same tag auto-match
- Manager verifies → `verification_status = 'manager_verified'`; employee can no longer edit
- Conflict detected (same normalized tag mapped to two players) → `verification_status = 'conflicting_match'`; flagged for manager resolution
- Manager blocks tag → `verification_status = 'blocked'`; tag never auto-matches

---

## AG. PROPOSED RECHARGE AND BONUS DESIGN

### Server-side calculation (never trust client)
```typescript
export function calculateRecharge(cashReceived: number, coinsRecharged: number): {
  bonus_given: number;
  missing_recharge: number;
  recharge_status: RechargeStatus;
} {
  const bonus_given = Math.max(coinsRecharged - cashReceived, 0);
  const missing_recharge = Math.max(cashReceived - coinsRecharged, 0);
  let recharge_status: RechargeStatus;
  if (bonus_given > 0) {
    recharge_status = 'completed_with_bonus';
  } else if (missing_recharge > 0) {
    recharge_status = 'under_recharged';
  } else {
    recharge_status = 'completed_no_bonus';
  }
  return { bonus_given, missing_recharge, recharge_status };
}
```

### Server action protections
- `cash_received` is always read from `payment_transactions.amount` server-side; the client-supplied value is ignored
- Transaction must exist, belong to the employee's shop, have `direction = 'received'`, and `status = 'confirmed'`
- `is_counted` must be true (rejected/unknown transactions cannot be recharged)
- No existing non-voided recharge on the same transaction (unless multiple recharges are explicitly permitted by the shop config)
- `employee_id` is set from the authenticated session, not from the client payload

---

## AH. PROPOSED REALTIME DESIGN

### Supabase Realtime subscriptions

**Employee subscription** (receives only individual authorized transactions):
```typescript
supabase
  .channel(`shop-transactions:${shopId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'payment_transactions',
    filter: `shop_id=eq.${shopId}`
  }, (payload) => {
    // Only add to UI if transaction matches employee's visible filter criteria
    // RLS enforces shop isolation at the database level
  })
  .subscribe();
```

**Manager subscription** (for new transactions needing review):
```typescript
supabase
  .channel(`manager-shop:${shopId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'payment_transactions',
    filter: `shop_id=eq.${shopId}`
  }, () => {
    // Trigger a re-fetch of manager summary (do NOT derive totals from Realtime payload alone)
    refreshManagerSummary();
  })
  .subscribe();
```

### Critical rules
- Employee Realtime channel must respect the same RLS that the REST query applies — no additional fields visible
- Manager totals are **never** broadcast through employee channels — the employee channel only triggers a UI refresh of the individual list
- Manager summary is always re-fetched from the server after a Realtime trigger, never computed client-side from accumulated payloads
- Realtime subscriptions must only start when `payment_dashboard_enabled = true` — no subscriptions start when flags are disabled
- The `gmail_connections` table must **never** be added to Realtime publications — OAuth tokens must never travel over Realtime

---

## AI. PROPOSED AUDIT LOG DESIGN

### Events to log in `payment_audit_logs`

| entity_type | action | Who can perform |
|---|---|---|
| player_payment_tag | created | employee |
| player_payment_tag | updated | employee, manager |
| player_payment_tag | verified | manager |
| player_payment_tag | blocked | manager |
| player_payment_tag | deactivated | manager |
| payment_recharge | created | employee |
| payment_recharge | voided | manager |
| gmail_connection | connected | manager |
| gmail_connection | disconnected | manager |
| gmail_connection | reconnected | manager |
| payment_transaction | status_changed | server (admin) |
| payment_transaction | marked_duplicate | server (admin) |
| payment_account | gmail_address_set | manager |

All audit inserts use `performed_by = auth.uid()` (or the service role user ID for server-initiated events). The `old_values` and `new_values` columns store JSON snapshots. OAuth token fields are **never** stored in audit log `old_values` or `new_values`.

---

## AJ. PROPOSED TEST STRATEGY

### Unit tests (to be added — currently zero tests in the project)
- `calculateRecharge()` — all combinations of bonus, missing, exact match
- `normalizePaymentTag()` — various input formats for CashApp and Chime
- `normalizeSender()` — display name parsing, whitespace, case
- `validateSender()` — approved, rejected, inactive, pending senders
- `parseCashAppEmail()` — received and sent patterns, edge cases
- `parseChimeEmail()` — received and sent patterns
- `encryptToken()` / `decryptToken()` — round-trip correctness

### Integration tests (Supabase local)
- RLS: employee cannot read another shop's transactions
- RLS: employee cannot read gmail_connections at all
- RLS: employee cannot read aggregate totals
- RLS: manager cannot read another shop's transactions
- RLS: employee cannot update manager-verified player mapping
- RLS: employee cannot insert recharge for a `sent` transaction
- Duplicate prevention: same gmail_message_id rejected on second insert
- Recharge double-submission: second recharge on same transaction blocked

### Manual QA checklist
- Connect Gmail → verify correct account confirmed
- Connect Gmail with wrong account → verify mismatch handled, no connection stored
- Receive test Cash App payment → verify transaction appears in employee dashboard
- Receive test Chime payment → verify transaction appears
- Add player mapping → verify auto-match on next payment from same tag
- Manager verify mapping → verify employee can no longer edit
- Create recharge → verify bonus/missing calculated correctly
- Attempt to recharge same transaction twice → verify blocked
- Disable feature flag → verify zero new UI rendered, zero new queries

---

## AK. PROPOSED CROSS-SHOP SECURITY TESTS

1. Employee A (shop 1) requests `/api/payment/transactions` — must only see shop 1 transactions
2. Employee A manually changes `shopId` in URL/body — server must always derive shop from session profile, never from request
3. Employee A queries `gmail_connections` table via Supabase browser client — must return zero rows
4. Manager A (shop 1) requests manager summary with `shop_id` of shop 2 in body — server must ignore body shop_id and use session-derived shop_id
5. Employee calls `createRecharge` server action with a `transactionId` from shop 2 — server must verify shop match before inserting
6. Employee calls `addPlayerMapping` with a `shop_id` from shop 2 in payload — server must use session shop_id and ignore payload shop_id
7. Direct Supabase query `SELECT * FROM gmail_connections` as employee role — must return zero rows
8. Direct Supabase query `SELECT encrypted_access_token FROM gmail_connections` as manager role — must be blocked or return null (column not exposed via RLS select)

---

## AL. PROPOSED VERCEL PREVIEW STRATEGY

1. Feature flags default to `false` — preview deployments can be tested without activating payment features
2. Use Vercel environment variables per deployment context: `preview` environment has `gmail_sync_enabled = false`
3. Add `PAYMENT_SYSTEM_PHASE` env var (e.g., `"phase_1_shell"`) so the app can log which phase is active
4. For Gmail OAuth testing in preview: use a dedicated non-production Google Cloud project with test Gmail accounts
5. Preview webhook: use `ngrok` or Vercel's preview URL registered as a Pub/Sub push endpoint for testing
6. Do not share `PAYMENT_TOKEN_ENCRYPTION_KEY` between preview and production — use separate keys

---

## AM. PROPOSED DATABASE BACKUP STRATEGY

1. Supabase automatic daily backups are already enabled for the project (confirm in Supabase dashboard)
2. Before running migration 0015 (the large schema migration): take a manual Supabase backup via the dashboard
3. Export and save the current production `supabase/migrations` folder to a dated archive before applying new migrations
4. After each migration in staging: verify with a smoke test query before proceeding to production
5. `gmail_connections` encrypted tokens: the `PAYMENT_TOKEN_ENCRYPTION_KEY` must be backed up separately and securely — if lost, all Gmail connections must be re-authorized

---

## AN. PROPOSED STAGED ROLLOUT

| Stage | What gets enabled | Who is affected |
|---|---|---|
| 1 | Migrations applied to staging only | Nobody |
| 2 | RLS verified in staging | Nobody |
| 3 | Feature flags deployed (all false) | Nobody |
| 4 | One test shop: `payment_dashboard_enabled = true` | One manager + employees only |
| 5 | Test shop: manual mock transactions inserted | One manager only |
| 6 | Gmail OAuth connected to test shop | One manager only |
| 7 | `gmail_sync_enabled = true` for test shop | One manager only |
| 8 | Verify parsed transactions match real emails | Owner + one manager |
| 9 | `manager_payment_summary_enabled = true` for test shop | One manager only |
| 10 | Employee views enabled for test shop | Employees of test shop |
| 11 | Expand to remaining shops one at a time | Each shop's manager/employees |

---

## AO. PROPOSED ROLLBACK STRATEGY

### Frontend rollback (immediate)
Set `payment_dashboard_enabled = false` in `shop_feature_flags` for any shop. All new UI disappears instantly without any code changes or redeployment.

### API/server action rollback
Vercel's "Instant Rollback" button reverts to the previous deployment. Feature flags remain in the database and will still be respected by the rolled-back code.

### Database rollback
New migrations are additive only — they only add new tables and columns. Rolling back the frontend leaves existing tables unused but harmless.

If a migration needs to be reversed in a true emergency:
- Drop new tables in reverse order: `payment_audit_logs`, `payment_recharges`, `player_payment_tags`, `payment_transactions`, `payment_email_events`, `payment_email_senders`, `gmail_connections`, `shop_feature_flags`
- Remove added columns from `payment_accounts`: `account_display_name`, `gmail_connection_id`, `connection_status`, `last_synced_at`, `updated_by`
- This does NOT touch any existing tables, existing columns, or existing RLS policies

---

## AP. EXACT IMPLEMENTATION PHASES

---

### PHASE 0 — Read-only repository audit ✅ COMPLETE
**Files created:** None
**Files modified:** None
**Database changes:** None
**Deliverable:** This document

---

### PHASE 1 — Feature flags + isolated frontend shells
**Goal:** Deploy new files behind permanently-disabled flags. Existing app is completely unchanged.

**Files created:**
- `src/lib/payment/feature-flags.ts`
- `src/lib/payment/payment-types.ts`
- `src/components/payment/` directory (empty shell components)
- `src/components/employee/live-payment-activity-preview.tsx` (renders nothing when no data)
- `src/components/employee/payment-activity-section.tsx` (renders nothing when no data)
- `src/components/manager/manager-payment-overview.tsx` (renders nothing when no data)
- `src/components/manager/payment-account-gmail-manager.tsx` (renders nothing when no data)

**Files modified:**
- `src/app/employee/page.tsx` — add feature-flag check + `<LivePaymentActivityPreview>` call
- `src/app/employee/payment-info/page.tsx` — add flag check + `<PaymentActivitySection>` call
- `src/app/manager/page.tsx` — add flag check + `<ManagerPaymentOverview>` call
- `src/app/manager/payment-accounts/page.tsx` — add flag check + `<PaymentAccountGmailManager>` call

**Database changes:** None yet

**Security checks:** Confirm all new component files check flags before rendering anything
**Build checks:** `npm run build` must pass with zero new errors
**Rollback:** Delete new files, revert 4 page edits (minimal diff)
**Condition to proceed:** Build passes, all existing pages render identically, flags verified at `false`

---

### PHASE 2 — Additive database schema + RLS
**Goal:** Apply new tables to staging. Verify RLS. Touch nothing in production until verified.

**Files created:**
- `supabase/migrations/0014_payment_system_feature_flags.sql`
- `supabase/migrations/0015_payment_system_schema.sql`
- `supabase/migrations/0016_payment_system_rls.sql`
- `supabase/migrations/0017_payment_system_indexes.sql`

**Database changes:** All new tables as documented in section V

**Tests required:**
- Apply migrations to local Supabase instance
- Verify all new tables exist
- Verify all 8 cross-shop security tests from section AK pass
- Verify existing tables and RLS are untouched
- Verify `payment_email_senders` contains two rows (CashApp verified, Chime pending)

**Security checks:** `gmail_connections` token columns confirmed inaccessible via anon/employee/manager RLS
**Rollback:** Drop new tables only — existing schema unaffected
**Condition to proceed:** All RLS tests pass in staging

---

### PHASE 3 — Employee individual-payment server responses
**Goal:** Build secure server-side query and API endpoint for employee transactions.

**Files created:**
- `src/lib/supabase/payment-server.ts`
- `src/app/api/payment/transactions/route.ts`

**Files modified:**
- `src/components/employee/live-payment-activity-preview.tsx` — implement data fetch
- `src/components/employee/payment-activity-section.tsx` — implement data fetch + filter UI
- `src/components/payment/payment-transaction-row.tsx` — implement shared row
- `src/components/payment/payment-transaction-table.tsx` — implement table

**Tests required:**
- Employee API returns ONLY fields listed in section T
- Response contains zero aggregate totals
- Different-shop employee gets zero results
- Manager hitting employee endpoint gets employee-shaped response only

**Condition to proceed:** Verified no aggregate data in employee response

---

### PHASE 4 — Player mapping + manager verification
**Files created:**
- `src/app/employee/payment-info/payment-actions.ts` (addPlayerMapping, editPlayerMapping)
- `src/components/payment/add-player-panel.tsx`
- `src/lib/payment/player-tag-normalizer.ts`

**Tests required:** Full normalization test suite, RLS tests for mapping creation/edit restrictions

---

### PHASE 5 — Recharge + bonus calculation
**Files created:**
- `src/lib/payment/recharge-calculator.ts`
- `src/components/payment/recharge-player-dialog.tsx`
- `src/app/employee/payment-info/payment-actions.ts` — add createRecharge

**Tests required:** All recharge calculation cases, double-submission prevention, wrong-shop blocking

---

### PHASE 6 — Manager Payment Overview
**Files modified:**
- `src/components/manager/manager-payment-overview.tsx` — implement

**Files created:**
- `src/app/api/payment/manager-summary/route.ts`

**Tests required:** Aggregate totals only visible to manager of authorized shop. Employee hitting manager endpoint gets 403.

---

### PHASE 7 — Manager Payment Accounts Gmail UI
**Files modified:**
- `src/components/manager/payment-account-gmail-manager.tsx` — implement
- `src/components/manager/gmail-connection-card.tsx` — implement

**Tests required:** Gmail status states render correctly. Connect/Reconnect/Disconnect buttons visible only to authorized manager.

---

### PHASE 8 — Gmail OAuth + encrypted token storage
**Files created:**
- `src/lib/payment/gmail-crypto.ts`
- `src/lib/payment/gmail-oauth.ts`
- `src/app/api/gmail/callback/route.ts`
- `src/app/manager/payment-accounts/gmail-actions.ts`

**Environment variables added:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GMAIL_OAUTH_STATE_SECRET`, `PAYMENT_TOKEN_ENCRYPTION_KEY`

**Tests required:** OAuth state signing/verification. Wrong-account mismatch handled. Tokens encrypted and not returned from any API.

---

### PHASE 9 — Sender allowlist + email event processing
**Files created:**
- `src/lib/payment/sender-validator.ts`
- `src/lib/payment/gmail-history.ts`
- `src/app/api/gmail/webhook/route.ts`

**Tests required:** Exact sender match only. Partial/fuzzy matches rejected. Rejected events stored but not counted.

**NOTE:** Confirm exact Chime sender address before setting `is_active = true` for Chime sender in `payment_email_senders`.

---

### PHASE 10 — Cash App + Chime parsers
**Files created:**
- `src/lib/payment/parsers/cashapp.ts`
- `src/lib/payment/parsers/chime.ts`

**Tests required:** Parser unit tests against real (anonymized) email samples. `unknown_format` returned for unrecognized emails.

---

### PHASE 11 — Realtime updates
**Files modified:**
- `src/components/employee/live-payment-activity-preview.tsx` — add Realtime subscription
- `src/components/employee/payment-activity-section.tsx` — add Realtime subscription

**Tests required:** Employee subscription never receives data from another shop. Manager summary never updates through employee channel.

---

### PHASE 12 — Manual + automated testing
Run full test suite from section AJ and AK. Manual QA checklist.

---

### PHASE 13 — Staging + one-shop rollout
Enable flags for one test shop only. Reconcile parsed transactions against real emails with the manager. Fix any parser issues before proceeding.

---

### PHASE 14 — Production rollout with feature flags
Enable per-shop, one at a time. Monitor `payment_email_events` for rejected senders or parse failures.

---

## AQ. QUESTIONS AND UNCERTAINTIES FROM THE REAL REPOSITORY

1. **Chime sender address typo:** The Chime sender `alers@account.chime.com` likely has a typo (missing `t` — should be `alerts@`). This MUST be confirmed from a real Chime payment email before the sender is activated. The system is designed to handle this safely — the Chime sender is seeded as `pending_verification` and `is_active = false`.

2. **Payment accounts `email` field vs Gmail address:** The existing `payment_accounts.email` field is ambiguous — it is used as the Cash App/Chime account login email, but it could also be the associated Gmail notification email. We need to clarify: is the CashApp account email the same Gmail used for payment notifications? If yes, we can reuse the existing `email` column to pre-populate the Gmail connection. If no, we need the new `account_display_name` column and a separate Gmail address field.

3. **One or multiple Gmail per payment account:** Does each Cash App account get its own Gmail? Or does one Gmail send notifications for multiple Cash App accounts? The blueprint handles both cases (Gmail connection is linked to one payment account, but can be expanded to support multiple accounts per Gmail if needed).

4. **`payment_accounts` missing `account_display_name`:** Currently accounts are identified only by their `tag` column (e.g., `$CashTag`). The payment activity UI references a "business payment account display name." A new `account_display_name` column should be added, or the `tag` column can serve this purpose.

5. **Google Cloud project:** Does one exist? What Pub/Sub topic is configured? If none, Phase 8 requires creating a Google Cloud project, enabling the Gmail API and Pub/Sub API, creating a service account, and configuring the push subscription.

6. **Supabase project tier:** Gmail watch renewals and webhook processing require consistent server uptime. Verify the Supabase project is on a plan that supports the required Realtime and database load.

7. **`shop_members` table vs `profiles.shop_id`:** The portal uses both. `profiles.shop_id` is the primary shop assignment used in all RLS policies. `shop_members` is seeded during user creation but not actively read by any current RLS policy. The payment system's new RLS follows the existing pattern (`public.current_shop_id()` which reads `profiles.shop_id`). This is consistent but worth noting — the `shop_members` table appears unused in current RLS.

8. **No existing API routes:** The portal has zero `src/app/api/` routes. The Gmail webhook and OAuth callback must introduce the first API routes. Verify that Vercel's deployment handles these correctly and that the domain's HTTPS is configured (required for Google OAuth redirect URI).

9. **`shift_payment_entries` table:** This table exists in migration 0001 but appears to have zero usage in the current portal code (no page reads from it). It may be a legacy table. It should not be confused with the new payment system.

10. **Package.json has uncommitted changes:** Git shows `package.json` and `package-lock.json` as modified but not staged. These changes should be reviewed and committed before Phase 1 begins.

---

## AR. REQUESTED FEATURES THAT CONFLICT WITH EXISTING ARCHITECTURE

1. **No conflicts found** that would require breaking changes to existing features. All additions are behind feature flags and in new files/components.

2. **Potential naming collision:** The existing `payment_accounts` table will need new columns (`account_display_name`, `gmail_connection_id`, `connection_status`, `last_synced_at`, `updated_by`). These are additive ALTER TABLE changes and do not affect existing queries since Supabase `select("*")` will include new columns but existing code only uses named fields. However, the `CrudPageClient` uses `select("*")` and passes all rows to the table renderer — the new columns will appear in the edit form if not explicitly excluded. **Fix:** Add an `excludeFromForm` option to `FieldConfig` or simply omit the new columns from the manager's `fields` array in `payment-accounts/page.tsx`.

3. **`email` field ambiguity:** The existing `email` field on `payment_accounts` is rendered in the employee's PaymentCarousel and copied to clipboard. If we repurpose it as the Gmail address, employees will see the Gmail address. These should remain separate fields.

---

## AS. SECURITY RISKS THAT MUST BE RESOLVED BEFORE IMPLEMENTATION

### CRITICAL (must resolve before any Gmail work)

1. **Gmail OAuth tokens must never reach the browser.** The `gmail_connections` table must have zero RLS SELECT policies that expose `encrypted_access_token` or `encrypted_refresh_token`. All token reads go through the admin client (service role). This is designed correctly above but must be verified with an explicit security test after migration.

2. **`PAYMENT_TOKEN_ENCRYPTION_KEY` and `GMAIL_OAUTH_STATE_SECRET` must never be committed to git.** Add explicit entries to `.gitignore` and verify `.env.local` is already ignored (it is).

3. **Gmail Pub/Sub webhook must be authenticated.** Google does not add a signature to standard push messages. Use the `X-Goog-Channel-Token` header OR verify the Pub/Sub subscription name in the request. Without this check, any party who discovers the webhook URL could send fake payment notifications.

4. **OAuth state parameter must be cryptographically signed.** Without HMAC signing of the state parameter, an attacker could forge a state value and trick the callback into storing OAuth tokens for the wrong account. This is implemented above using HMAC-SHA256.

### HIGH (must resolve before employee data is live)

5. **Manager totals must not bleed into employee API responses.** The `/api/payment/transactions` endpoint must have an explicit test (automated, not just manual) that verifies no aggregate fields appear in the response. This is the single most important data-separation check.

6. **`current_shop_id()` helper function used by all RLS policies reads `profiles.shop_id`.** If an employee's `shop_id` is ever `null` (not yet assigned), `current_shop_id()` returns `null`, and `shop_id = null` comparisons in WHERE clauses behave unpredictably in PostgreSQL (NULL ≠ NULL). All new RLS policies that use `shop_id = public.current_shop_id()` should include a `and public.current_shop_id() is not null` guard — this follows the existing pattern and is already in the proposed policies above.

7. **Employees currently have no explicit deny for aggregate queries.** The existing `payment_accounts_select` RLS policy allows employees to see active accounts for their shop — this is correct. However, when payment totals are added, a direct `SELECT sum(amount) FROM payment_transactions WHERE shop_id = ?` by an employee would succeed and return totals. The `payment_transactions` RLS as proposed does not expose totals — employees can only SELECT rows, not aggregate. This should be verified explicitly: an employee who does `SELECT sum(amount)...` should get back a sum of only the rows they can see (individual transactions), not a prohibited aggregate. This is actually correct behavior — the column-level restriction is that the employee sees `amount` per row, but summing those visible rows is technically allowed by PostgreSQL RLS. If this is a concern, the server API endpoint should be the only way employees retrieve transaction data (not direct Supabase browser queries).

### MEDIUM (resolve before production)

8. **`next.config.mjs` uses `{ hostname: '**' }` for image remotePatterns.** This allows images from any domain. When payment images are involved, consider scoping this to the Supabase storage domain and any expected CDN.

9. **`signup` route exists** (`src/app/signup/page.tsx`) but the migration notes say public signup was intentionally removed. The signup page should either be removed or gated to prevent new self-service account creation.

---

## SUMMARY TABLE — EXISTING PAYMENT_ACCOUNTS COLUMNS

For reference, the current `payment_accounts` table columns from migrations 0001–0013:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| shop_id | uuid | FK → shops |
| payment_type | text | 'CashApp' or 'Chime' |
| tag | text | $cashtag or chime tag |
| email | text | account login email (NOT Gmail notification address) |
| password | text | stored plaintext — existing behavior |
| image_url | text | Supabase Storage URL |
| payment_link | text | added in migration 0005 |
| status | text | 'active' or 'inactive' |
| notes | text | |
| created_by | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Note:** Passwords are stored plaintext in the current system. This is pre-existing behavior and outside the scope of this payment system implementation. It should be flagged as a separate security concern for the owner to address.

---

*End of Phase 0 Audit and Implementation Blueprint*
*Do not begin Phase 1 until this document has been reviewed and approved.*
