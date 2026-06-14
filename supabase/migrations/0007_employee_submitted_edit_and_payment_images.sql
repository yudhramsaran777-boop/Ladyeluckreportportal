-- ============================================================================
-- Lady E Luck Portal - Migration 0007
-- Employee submitted-report edits and payment account image storage.
-- ============================================================================

alter table public.payment_accounts add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('payment-account-images', 'payment-account-images', true)
on conflict (id) do update set public = true;

do $$
declare
  legacy_column text;
begin
  foreach legacy_column in array array['image', 'imageUrl', 'imageurl', 'qr_image', 'photo', 'thumbnail']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payment_accounts'
        and column_name = legacy_column
    ) then
      execute format(
        'update public.payment_accounts set image_url = coalesce(image_url, %I::text) where image_url is null and %I is not null',
        legacy_column,
        legacy_column
      );
    end if;
  end loop;
end $$;

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

drop policy if exists "shift_reports_update" on public.shift_reports;
create policy "shift_reports_update" on public.shift_reports
  for update using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      employee_id = auth.uid()
      and status in ('draft', 'submitted', 'needs_correction')
    )
  ) with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      employee_id = auth.uid()
      and status in ('draft', 'submitted', 'needs_correction')
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
          or (
            sr.employee_id = auth.uid()
            and sr.status in ('draft', 'submitted', 'needs_correction')
          )
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
          or (
            sr.employee_id = auth.uid()
            and sr.status in ('draft', 'submitted', 'needs_correction')
          )
        )
    )
  ) with check (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
          or (
            sr.employee_id = auth.uid()
            and sr.status in ('draft', 'submitted', 'needs_correction')
          )
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
          or (
            sr.employee_id = auth.uid()
            and sr.status in ('draft', 'submitted', 'needs_correction')
          )
        )
    )
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
        and sr.status in ('draft', 'submitted', 'needs_correction')
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
        and sr.status in ('draft', 'submitted', 'needs_correction')
    )
  ) with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and sr.employee_id = auth.uid()
        and sr.status in ('draft', 'submitted', 'needs_correction')
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
        and sr.status in ('draft', 'submitted', 'needs_correction')
    )
  );

notify pgrst, 'reload schema';
