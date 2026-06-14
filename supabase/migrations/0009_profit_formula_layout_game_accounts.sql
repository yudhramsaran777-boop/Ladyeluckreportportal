-- ============================================================================
-- Lady E Luck Portal - Migration 0009
-- Normalize profit fields and game account visibility for employee game logins.
-- ============================================================================

update public.shift_game_entries
set
  normal_coin_difference = starting_coins_after_add - ending_coins,
  real_recharge = starting_coins_after_add + redeem_coins - ending_coins,
  game_cost = ((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100,
  gross_profit = starting_coins_after_add - ending_coins,
  true_profit = (starting_coins_after_add - ending_coins)
    - (((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100);

alter table public.game_accounts alter column status set default 'active';

update public.game_accounts
set status = 'active'
where status is null
   or lower(btrim(status)) not in ('inactive', 'disabled', 'disable', 'false');

update public.game_accounts
set status = 'inactive'
where lower(btrim(status)) in ('inactive', 'disabled', 'disable', 'false');

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
