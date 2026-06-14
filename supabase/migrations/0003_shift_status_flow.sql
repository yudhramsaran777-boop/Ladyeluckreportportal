-- ============================================================================
-- Lady E Luck Portal - Shift report status flow (draft / submitted /
-- needs_correction / approved / locked) and related RLS policy updates.
--
-- Safe to re-run: uses `add column if not exists` and `drop policy if
-- exists` + `create policy`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columns (idempotent - most of these already exist from 0001_init.sql)
-- ----------------------------------------------------------------------------
alter table public.payment_accounts add column if not exists image_url text;
alter table public.game_accounts add column if not exists game_link text;
alter table public.game_accounts add column if not exists admin_link text;
alter table public.game_accounts add column if not exists vendor text;
alter table public.game_accounts add column if not exists admin_name text;
alter table public.game_accounts add column if not exists notes text;
alter table public.game_accounts add column if not exists status text default 'active';
alter table public.shift_reports add column if not exists status text default 'draft';
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- shift_reports
-- ----------------------------------------------------------------------------
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
    or (employee_id = auth.uid() and status in ('draft','needs_correction'))
  )
  with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (employee_id = auth.uid() and status in ('draft','submitted','needs_correction'))
  );

drop policy if exists "shift_reports_delete" on public.shift_reports;
create policy "shift_reports_delete" on public.shift_reports
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

-- ----------------------------------------------------------------------------
-- shift_game_entries (inherit access via parent shift_report)
-- ----------------------------------------------------------------------------
drop policy if exists "shift_game_entries_select" on public.shift_game_entries;
create policy "shift_game_entries_select" on public.shift_game_entries
  for select using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or sr.shop_id = public.current_shop_id()
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
          or (sr.employee_id = auth.uid() and sr.status in ('draft','needs_correction'))
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
          or (sr.employee_id = auth.uid() and sr.status in ('draft','needs_correction'))
        )
    )
  );

drop policy if exists "shift_game_entries_delete" on public.shift_game_entries;
create policy "shift_game_entries_delete" on public.shift_game_entries
  for delete using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or (sr.employee_id = auth.uid() and sr.status in ('draft','needs_correction'))
        )
    )
  );

-- ----------------------------------------------------------------------------
-- shift_cashouts
-- ----------------------------------------------------------------------------
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
    or exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and sr.employee_id = auth.uid()
        and sr.status in ('draft','needs_correction')
    )
  );

drop policy if exists "shift_cashouts_update" on public.shift_cashouts;
create policy "shift_cashouts_update" on public.shift_cashouts
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and sr.employee_id = auth.uid()
        and sr.status in ('draft','needs_correction')
    )
  );

drop policy if exists "shift_cashouts_delete" on public.shift_cashouts;
create policy "shift_cashouts_delete" on public.shift_cashouts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and sr.employee_id = auth.uid()
        and sr.status in ('draft','needs_correction')
    )
  );
