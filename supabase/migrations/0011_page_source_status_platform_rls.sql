-- ============================================================================
-- Lady E Luck Portal - Migration 0011
-- Normalize page source data and employee visibility.
-- ============================================================================

update public.page_sources
set status = 'active'
where status is null
   or lower(btrim(status)) <> 'active';

update public.page_sources
set platform = 'Facebook'
where lower(btrim(coalesce(platform, ''))) in ('facebook', 'fb', 'meta', '');

update public.page_sources
set platform = 'Instagram'
where lower(btrim(coalesce(platform, ''))) in ('instagram', 'ig');

alter table public.page_sources alter column status set default 'active';
alter table public.page_sources alter column platform set default 'Facebook';
alter table public.page_sources enable row level security;

drop policy if exists "page_sources_select" on public.page_sources;
create policy "page_sources_select" on public.page_sources
  for select using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
    or (
      shop_id = public.current_shop_id()
      and lower(btrim(coalesce(status, 'active'))) = 'active'
    )
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
  ) with check (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "page_sources_delete" on public.page_sources;
create policy "page_sources_delete" on public.page_sources
  for delete using (
    public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

notify pgrst, 'reload schema';
