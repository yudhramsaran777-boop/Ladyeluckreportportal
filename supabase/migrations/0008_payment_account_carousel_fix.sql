-- ============================================================================
-- Lady E Luck Portal - Migration 0008
-- Normalize payment account data for employee CashApp/Chime carousel.
-- ============================================================================

alter table public.payment_accounts add column if not exists image_url text;
alter table public.payment_accounts alter column status set default 'active';

update public.payment_accounts
set payment_type = 'CashApp'
where lower(replace(replace(replace(coalesce(payment_type, ''), ' ', ''), '_', ''), '-', '')) = 'cashapp';

update public.payment_accounts
set payment_type = 'Chime'
where lower(replace(replace(replace(coalesce(payment_type, ''), ' ', ''), '_', ''), '-', '')) in ('chime', 'chimetag');

update public.payment_accounts
set status = 'active'
where status is null
   or lower(status) in ('active', 'enabled', 'enable', 'true');

update public.payment_accounts
set status = 'inactive'
where lower(status) in ('inactive', 'disabled', 'disable', 'false');

insert into storage.buckets (id, name, public)
values ('payment-account-images', 'payment-account-images', true)
on conflict (id) do update set public = true;

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
  ) with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "payment_accounts_delete" on public.payment_accounts;
create policy "payment_accounts_delete" on public.payment_accounts
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "payment_account_images_select" on storage.objects;
create policy "payment_account_images_select" on storage.objects
  for select using (bucket_id = 'payment-account-images');

drop policy if exists "payment_account_images_insert" on storage.objects;
create policy "payment_account_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-account-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "payment_account_images_update" on storage.objects;
create policy "payment_account_images_update" on storage.objects
  for update using (
    bucket_id = 'payment-account-images'
    and auth.role() = 'authenticated'
  ) with check (
    bucket_id = 'payment-account-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "payment_account_images_delete" on storage.objects;
create policy "payment_account_images_delete" on storage.objects
  for delete using (
    bucket_id = 'payment-account-images'
    and auth.role() = 'authenticated'
  );

notify pgrst, 'reload schema';
