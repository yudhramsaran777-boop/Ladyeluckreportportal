-- ============================================================================
-- Lady E Luck Portal — Migration 0016
-- Payment System: Row Level Security policies
-- Depends on: 0014 (shop_feature_flags), 0015 (payment schema)
-- Relies on existing SECURITY DEFINER helpers from 0001_init.sql:
--   public.current_shop_id()  — shop_id from the authenticated user's profile
--   public.is_owner()         — true if role = 'owner'
--   public.is_manager()       — true if role = 'manager'
-- ============================================================================

-- ---------------------------------------------------------------------------
-- shop_feature_flags
-- Owner can read/write all shops' flags.
-- Manager and employee can read only their own shop's flags.
-- No browser role can insert/update/delete (owner uses dashboard or SQL).
-- ---------------------------------------------------------------------------
alter table public.shop_feature_flags enable row level security;

drop policy if exists "feature_flags_select" on public.shop_feature_flags;
create policy "feature_flags_select" on public.shop_feature_flags
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "feature_flags_owner_write" on public.shop_feature_flags;
create policy "feature_flags_owner_write" on public.shop_feature_flags
  for all using (public.is_owner());

-- ---------------------------------------------------------------------------
-- gmail_connections
-- CRITICAL SECURITY:
--   - No employee may read any row.
--   - Manager/owner may see metadata rows for their shop, but token columns
--     (encrypted_access_token, encrypted_refresh_token, token_iv, refresh_iv)
--     are only accessible via the service-role key (server-side admin client).
--   - No browser role may insert, update, or delete — all writes go through
--     server actions using the admin client.
--   - This table must NEVER be added to Supabase Realtime publications.
-- ---------------------------------------------------------------------------
alter table public.gmail_connections enable row level security;

drop policy if exists "gmail_connections_select" on public.gmail_connections;
create policy "gmail_connections_select" on public.gmail_connections
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- No insert/update/delete policies for browser roles. All mutations are
-- performed server-side via the service-role admin client.

-- ---------------------------------------------------------------------------
-- payment_email_senders
-- All authenticated users can read verified/active senders (needed for
-- display purposes). Owner can manage (insert/update/delete).
-- ---------------------------------------------------------------------------
alter table public.payment_email_senders enable row level security;

drop policy if exists "senders_select" on public.payment_email_senders;
create policy "senders_select" on public.payment_email_senders
  for select using (auth.uid() is not null);

drop policy if exists "senders_owner_write" on public.payment_email_senders;
create policy "senders_owner_write" on public.payment_email_senders
  for all using (public.is_owner());

-- ---------------------------------------------------------------------------
-- payment_email_events
-- Manager and owner only — employees never see raw email events.
-- No browser insert — server-side only via admin client.
-- ---------------------------------------------------------------------------
alter table public.payment_email_events enable row level security;

drop policy if exists "email_events_select" on public.payment_email_events;
create policy "email_events_select" on public.payment_email_events
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- payment_transactions
-- Employees can read confirmed/pending AND is_counted = true transactions
-- for their own shop. They NEVER see aggregate totals, rejected records,
-- or transactions from other shops.
-- Manager/owner can read all transactions for their shop(s).
-- No browser insert/update/delete — server-side only via admin client.
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;

drop policy if exists "transactions_employee_select" on public.payment_transactions;
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

-- ---------------------------------------------------------------------------
-- player_payment_tags
-- Employees can read all mappings for their shop.
-- Employees can insert only with verification_status = 'employee_added'.
-- Employees can update only their own non-verified mappings.
-- Only manager/owner can delete.
-- Manager/owner can update any mapping for their shop (for verification).
-- ---------------------------------------------------------------------------
alter table public.player_payment_tags enable row level security;

drop policy if exists "player_tags_select" on public.player_payment_tags;
create policy "player_tags_select" on public.player_payment_tags
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "player_tags_employee_insert" on public.player_payment_tags;
create policy "player_tags_employee_insert" on public.player_payment_tags
  for insert with check (
    shop_id = public.current_shop_id()
    and verification_status = 'employee_added'
  );

drop policy if exists "player_tags_employee_update" on public.player_payment_tags;
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

drop policy if exists "player_tags_manager_delete" on public.player_payment_tags;
create policy "player_tags_manager_delete" on public.player_payment_tags
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- payment_recharges
-- Employees can read recharges for their own shop.
-- Employees can insert recharges for their shop (server action validates
-- that cash_received matches payment_transactions.amount).
-- Void/update is manager/owner only.
-- ---------------------------------------------------------------------------
alter table public.payment_recharges enable row level security;

drop policy if exists "recharges_select" on public.payment_recharges;
create policy "recharges_select" on public.payment_recharges
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "recharges_employee_insert" on public.payment_recharges;
create policy "recharges_employee_insert" on public.payment_recharges
  for insert with check (
    shop_id = public.current_shop_id()
    and employee_id = auth.uid()
  );

drop policy if exists "recharges_manager_update" on public.payment_recharges;
create policy "recharges_manager_update" on public.payment_recharges
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- payment_audit_logs
-- Employees cannot read. Manager can read their own shop's logs.
-- Any authenticated user can insert (server actions write on behalf of user).
-- No update/delete — audit logs are append-only.
-- ---------------------------------------------------------------------------
alter table public.payment_audit_logs enable row level security;

drop policy if exists "payment_audit_select" on public.payment_audit_logs;
create policy "payment_audit_select" on public.payment_audit_logs
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "payment_audit_insert" on public.payment_audit_logs;
create policy "payment_audit_insert" on public.payment_audit_logs
  for insert with check (auth.uid() is not null);
