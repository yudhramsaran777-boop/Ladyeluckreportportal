-- ============================================================================
-- Lady E Luck Portal - Reassert payment_accounts / game_accounts RLS
--
-- Ensures:
--  - Employees can SELECT active payment_accounts / game_accounts for their
--    own shop (shop_id = current employee profile.shop_id, status = 'active').
--  - Managers can SELECT/INSERT/UPDATE/DELETE rows for their own shop only
--    (shop_id = current manager profile.shop_id).
--  - Owners can do everything.
--
-- Safe to re-run: drops and recreates the policies below.
-- ============================================================================

alter table public.payment_accounts enable row level security;
alter table public.game_accounts enable row level security;

-- ---------------------------------------------------------------------------
-- payment_accounts
-- ---------------------------------------------------------------------------
drop policy if exists "payment_accounts_select" on public.payment_accounts;
create policy "payment_accounts_select" on public.payment_accounts
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (shop_id = public.current_shop_id() and status = 'active')
  );

drop policy if exists "payment_accounts_insert" on public.payment_accounts;
create policy "payment_accounts_insert" on public.payment_accounts
  for insert with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "payment_accounts_update" on public.payment_accounts;
create policy "payment_accounts_update" on public.payment_accounts
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "payment_accounts_delete" on public.payment_accounts;
create policy "payment_accounts_delete" on public.payment_accounts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- game_accounts
-- ---------------------------------------------------------------------------
drop policy if exists "game_accounts_select" on public.game_accounts;
create policy "game_accounts_select" on public.game_accounts
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (shop_id = public.current_shop_id() and status = 'active')
  );

drop policy if exists "game_accounts_insert" on public.game_accounts;
create policy "game_accounts_insert" on public.game_accounts
  for insert with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "game_accounts_update" on public.game_accounts;
create policy "game_accounts_update" on public.game_accounts
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "game_accounts_delete" on public.game_accounts;
create policy "game_accounts_delete" on public.game_accounts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

notify pgrst, 'reload schema';
