-- ============================================================================
-- Lady E Luck Portal - Migration 0010
-- Make employee game-login visibility tolerant of legacy status values.
-- ============================================================================

update public.game_accounts
set status = 'active'
where status is null
   or lower(btrim(status)) <> 'inactive';

update public.game_accounts
set status = 'inactive'
where lower(btrim(status)) = 'inactive';

alter table public.game_accounts alter column status set default 'active';
alter table public.game_accounts enable row level security;

drop policy if exists "game_accounts_select" on public.game_accounts;
create policy "game_accounts_select" on public.game_accounts
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      shop_id = public.current_shop_id()
      and lower(btrim(coalesce(status, 'active'))) = 'active'
    )
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
  ) with check (
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
