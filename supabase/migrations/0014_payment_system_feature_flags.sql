-- ============================================================================
-- Lady E Luck Portal — Migration 0014
-- Payment System: shop_feature_flags table
-- All flags default false. Enablement is done manually via Supabase dashboard
-- or owner SQL. No flag is auto-enabled by this migration.
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: shop_feature_flags
-- One row per shop. All payment feature gates live here.
-- ---------------------------------------------------------------------------
create table if not exists public.shop_feature_flags (
  id                             uuid        primary key default gen_random_uuid(),
  shop_id                        uuid        not null references public.shops(id) on delete cascade,
  payment_dashboard_enabled      boolean     not null default false,
  gmail_sync_enabled             boolean     not null default false,
  manager_payment_summary_enabled boolean    not null default false,
  enabled_by                     uuid        references public.profiles(id) on delete set null,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  unique(shop_id)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger (mirrors pattern from existing tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_shop_feature_flags_updated_at'
  ) then
    create trigger set_shop_feature_flags_updated_at
      before update on public.shop_feature_flags
      for each row execute function public.set_updated_at();
  end if;
end $$;
