-- ============================================================================
-- Lady E Luck Portal - Migration 0006
-- Fixes:
--   1. shift_game_entries_delete: allow employees to delete their own entries
--      (required for Save Draft / Submit to work — persistEntries does delete+reinsert)
--   2. Ensure payment_link column exists on payment_accounts
--   3. Reassert all status defaults and RLS for payment_accounts, game_accounts,
--      page_sources, and shift_* tables (safe to re-run, idempotent)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. payment_link column (idempotent)
-- ---------------------------------------------------------------------------
alter table public.payment_accounts add column if not exists payment_link text;

-- ---------------------------------------------------------------------------
-- 2. Status defaults (ensure all three tables default to 'active')
-- ---------------------------------------------------------------------------
alter table public.payment_accounts alter column status set default 'active';
alter table public.game_accounts     alter column status set default 'active';
alter table public.page_sources      alter column status set default 'active';

-- ---------------------------------------------------------------------------
-- 3. Fix shift_game_entries_delete — must also allow the owning employee
-- ---------------------------------------------------------------------------
drop policy if exists "shift_game_entries_delete" on public.shift_game_entries;
create policy "shift_game_entries_delete" on public.shift_game_entries
  for delete using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or sr.employee_id = auth.uid()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Reassert payment_accounts RLS (idempotent)
-- ---------------------------------------------------------------------------
alter table public.payment_accounts enable row level security;

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
-- 5. Reassert game_accounts RLS (idempotent)
-- ---------------------------------------------------------------------------
alter table public.game_accounts enable row level security;

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

-- ---------------------------------------------------------------------------
-- 6. Reassert page_sources RLS (idempotent)
-- ---------------------------------------------------------------------------
alter table public.page_sources enable row level security;

drop policy if exists "page_sources_select" on public.page_sources;
create policy "page_sources_select" on public.page_sources
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (shop_id = public.current_shop_id() and status = 'active')
  );

drop policy if exists "page_sources_insert" on public.page_sources;
create policy "page_sources_insert" on public.page_sources
  for insert with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "page_sources_update" on public.page_sources;
create policy "page_sources_update" on public.page_sources
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "page_sources_delete" on public.page_sources;
create policy "page_sources_delete" on public.page_sources
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- 7. Reassert shift_reports RLS (idempotent)
-- ---------------------------------------------------------------------------
drop policy if exists "shift_reports_select" on public.shift_reports;
create policy "shift_reports_select" on public.shift_reports
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_reports_insert" on public.shift_reports;
create policy "shift_reports_insert" on public.shift_reports
  for insert with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_reports_update" on public.shift_reports;
create policy "shift_reports_update" on public.shift_reports
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_reports_delete" on public.shift_reports;
create policy "shift_reports_delete" on public.shift_reports
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ---------------------------------------------------------------------------
-- 8. Reassert shift_game_entries RLS (select / insert / update already OK;
--    delete was just fixed above)
-- ---------------------------------------------------------------------------
drop policy if exists "shift_game_entries_select" on public.shift_game_entries;
create policy "shift_game_entries_select" on public.shift_game_entries
  for select using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or sr.employee_id = auth.uid()
        )
    )
  );

drop policy if exists "shift_game_entries_insert" on public.shift_game_entries;
create policy "shift_game_entries_insert" on public.shift_game_entries
  for insert with check (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or sr.employee_id = auth.uid()
        )
    )
  );

drop policy if exists "shift_game_entries_update" on public.shift_game_entries;
create policy "shift_game_entries_update" on public.shift_game_entries
  for update using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or sr.employee_id = auth.uid()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Reassert shift_cashouts RLS (idempotent)
-- ---------------------------------------------------------------------------
drop policy if exists "shift_cashouts_select" on public.shift_cashouts;
create policy "shift_cashouts_select" on public.shift_cashouts
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_cashouts_insert" on public.shift_cashouts;
create policy "shift_cashouts_insert" on public.shift_cashouts
  for insert with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_cashouts_update" on public.shift_cashouts;
create policy "shift_cashouts_update" on public.shift_cashouts
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

drop policy if exists "shift_cashouts_delete" on public.shift_cashouts;
create policy "shift_cashouts_delete" on public.shift_cashouts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or employee_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
