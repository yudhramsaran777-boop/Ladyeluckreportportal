-- ============================================================================
-- Lady E Luck Portal - Initial schema, RLS policies, storage, and seed data
-- Run this entire file in the Supabase SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where practical.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'employee' check (role in ('owner','manager','employee')),
  shop_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles.shop_id -> shops.id (added after shops exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_shop_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_shop_id_fkey
      foreign key (shop_id) references public.shops(id) on delete set null;
  end if;
end $$;

create table if not exists public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('manager','employee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  game_code text unique not null,
  game_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_settings (
  id uuid primary key default gen_random_uuid(),
  game_code text unique not null,
  game_name text not null,
  cost_percentage numeric not null default 0,
  is_active boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  payment_type text not null check (payment_type in ('CashApp','Chime')),
  tag text,
  email text,
  password text,
  image_url text,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  game_code text not null,
  game_name text not null,
  game_link text,
  admin_link text,
  username text,
  password text,
  vendor text,
  admin_name text,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_sources (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  page_name text not null,
  platform text not null default 'Facebook',
  page_url text,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  employee_name text,
  shift_date date not null default current_date,
  shift_interval text,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_game_entries (
  id uuid primary key default gen_random_uuid(),
  shift_report_id uuid references public.shift_reports(id) on delete cascade,
  game_code text not null,
  game_name text not null,
  opening_coins_before_add numeric not null default 0,
  admin_added_coins numeric not null default 0,
  starting_coins_after_add numeric not null default 0,
  redeem_coins numeric not null default 0,
  ending_coins numeric not null default 0,
  normal_coin_difference numeric not null default 0,
  real_recharge numeric not null default 0,
  redeem_amount numeric not null default 0,
  game_cost_percentage numeric not null default 0,
  game_cost numeric not null default 0,
  gross_profit numeric not null default 0,
  true_profit numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_cashouts (
  id uuid primary key default gen_random_uuid(),
  shift_report_id uuid references public.shift_reports(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  employee_id uuid references public.profiles(id) on delete set null,
  customer_facebook_name text,
  game_code text not null,
  game_name text not null,
  game_username text,
  amount numeric not null default 0,
  payment_method text not null default 'CashApp',
  payment_tag text,
  page_source_id uuid references public.page_sources(id) on delete set null,
  page_source_name text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_payment_entries (
  id uuid primary key default gen_random_uuid(),
  shift_report_id uuid references public.shift_reports(id) on delete cascade,
  payment_type text,
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  starting_balance numeric not null default 0,
  ending_balance numeric not null default 0,
  cash_entered numeric not null default 0,
  admin_cashout numeric not null default 0,
  difference numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_profiles_shop_id on public.profiles(shop_id);
create index if not exists idx_shop_members_shop_id on public.shop_members(shop_id);
create index if not exists idx_shop_members_user_id on public.shop_members(user_id);
create index if not exists idx_payment_accounts_shop_id on public.payment_accounts(shop_id);
create index if not exists idx_game_accounts_shop_id on public.game_accounts(shop_id);
create index if not exists idx_page_sources_shop_id on public.page_sources(shop_id);
create index if not exists idx_shift_reports_shop_id on public.shift_reports(shop_id);
create index if not exists idx_shift_reports_employee_id on public.shift_reports(employee_id);
create index if not exists idx_shift_game_entries_report_id on public.shift_game_entries(shift_report_id);
create index if not exists idx_shift_cashouts_report_id on public.shift_cashouts(shift_report_id);
create index if not exists idx_shift_cashouts_shop_id on public.shift_cashouts(shop_id);

-- ============================================================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion on profiles)
-- ============================================================================

create or replace function public.current_role_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_shop_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'owner', false);
$$;

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'manager', false);
$$;

-- ============================================================================
-- NEW USER TRIGGER -> create profile row, first user becomes owner
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_count integer;
  assigned_role text;
begin
  select count(*) into profile_count from public.profiles;

  if profile_count = 0 then
    assigned_role := 'owner';
  else
    assigned_role := 'employee';
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    assigned_role,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.games enable row level security;
alter table public.game_settings enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.game_accounts enable row level security;
alter table public.page_sources enable row level security;
alter table public.shift_reports enable row level security;
alter table public.shift_game_entries enable row level security;
alter table public.shift_cashouts enable row level security;
alter table public.shift_payment_entries enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_owner()
    or (public.is_manager() and shop_id = public.current_shop_id())
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_owner());

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles
  for insert with check (public.is_owner() or id = auth.uid());

drop policy if exists "profiles_owner_delete" on public.profiles;
create policy "profiles_owner_delete" on public.profiles
  for delete using (public.is_owner());

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------
drop policy if exists "shops_select" on public.shops;
create policy "shops_select" on public.shops
  for select using (
    public.is_owner()
    or id = public.current_shop_id()
  );

drop policy if exists "shops_owner_all" on public.shops;
create policy "shops_owner_insert" on public.shops
  for insert with check (public.is_owner());
create policy "shops_owner_update" on public.shops
  for update using (public.is_owner());
create policy "shops_owner_delete" on public.shops
  for delete using (public.is_owner());

-- ---------------------------------------------------------------------------
-- shop_members
-- ---------------------------------------------------------------------------
drop policy if exists "shop_members_select" on public.shop_members;
create policy "shop_members_select" on public.shop_members
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
    or user_id = auth.uid()
  );

drop policy if exists "shop_members_write" on public.shop_members;
create policy "shop_members_insert" on public.shop_members
  for insert with check (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "shop_members_update" on public.shop_members
  for update using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "shop_members_delete" on public.shop_members
  for delete using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));

-- ---------------------------------------------------------------------------
-- games (reference table - readable by all authenticated users)
-- ---------------------------------------------------------------------------
drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games
  for select using (auth.uid() is not null);

drop policy if exists "games_owner_write" on public.games;
create policy "games_owner_insert" on public.games
  for insert with check (public.is_owner());
create policy "games_owner_update" on public.games
  for update using (public.is_owner());
create policy "games_owner_delete" on public.games
  for delete using (public.is_owner());

-- ---------------------------------------------------------------------------
-- game_settings (readable by all authenticated users, editable by owner)
-- ---------------------------------------------------------------------------
drop policy if exists "game_settings_select" on public.game_settings;
create policy "game_settings_select" on public.game_settings
  for select using (auth.uid() is not null);

drop policy if exists "game_settings_owner_write" on public.game_settings;
create policy "game_settings_owner_insert" on public.game_settings
  for insert with check (public.is_owner());
create policy "game_settings_owner_update" on public.game_settings
  for update using (public.is_owner());
create policy "game_settings_owner_delete" on public.game_settings
  for delete using (public.is_owner());

-- ---------------------------------------------------------------------------
-- payment_accounts
-- ---------------------------------------------------------------------------
drop policy if exists "payment_accounts_select" on public.payment_accounts;
create policy "payment_accounts_select" on public.payment_accounts
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "payment_accounts_write" on public.payment_accounts;
create policy "payment_accounts_insert" on public.payment_accounts
  for insert with check (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "payment_accounts_update" on public.payment_accounts
  for update using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "payment_accounts_delete" on public.payment_accounts
  for delete using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));

-- ---------------------------------------------------------------------------
-- game_accounts
-- ---------------------------------------------------------------------------
drop policy if exists "game_accounts_select" on public.game_accounts;
create policy "game_accounts_select" on public.game_accounts
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "game_accounts_write" on public.game_accounts;
create policy "game_accounts_insert" on public.game_accounts
  for insert with check (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "game_accounts_update" on public.game_accounts
  for update using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "game_accounts_delete" on public.game_accounts
  for delete using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));

-- ---------------------------------------------------------------------------
-- page_sources
-- ---------------------------------------------------------------------------
drop policy if exists "page_sources_select" on public.page_sources;
create policy "page_sources_select" on public.page_sources
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
  );

drop policy if exists "page_sources_write" on public.page_sources;
create policy "page_sources_insert" on public.page_sources
  for insert with check (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "page_sources_update" on public.page_sources
  for update using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));
create policy "page_sources_delete" on public.page_sources
  for delete using (public.is_owner() or (public.is_manager() and shop_id = public.current_shop_id()));

-- ---------------------------------------------------------------------------
-- shift_reports
-- ---------------------------------------------------------------------------
drop policy if exists "shift_reports_select" on public.shift_reports;
create policy "shift_reports_select" on public.shift_reports
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
    or employee_id = auth.uid()
  );

drop policy if exists "shift_reports_insert" on public.shift_reports;
create policy "shift_reports_insert" on public.shift_reports
  for insert with check (
    public.is_owner()
    or shop_id = public.current_shop_id()
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
-- shift_game_entries (inherit access via parent shift_report)
-- ---------------------------------------------------------------------------
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

drop policy if exists "shift_game_entries_write" on public.shift_game_entries;
create policy "shift_game_entries_insert" on public.shift_game_entries
  for insert with check (
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
create policy "shift_game_entries_update" on public.shift_game_entries
  for update using (
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
create policy "shift_game_entries_delete" on public.shift_game_entries
  for delete using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- shift_cashouts
-- ---------------------------------------------------------------------------
drop policy if exists "shift_cashouts_select" on public.shift_cashouts;
create policy "shift_cashouts_select" on public.shift_cashouts
  for select using (
    public.is_owner()
    or shop_id = public.current_shop_id()
    or employee_id = auth.uid()
  );

drop policy if exists "shift_cashouts_insert" on public.shift_cashouts;
create policy "shift_cashouts_insert" on public.shift_cashouts
  for insert with check (
    public.is_owner()
    or shop_id = public.current_shop_id()
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
-- shift_payment_entries (inherit via parent shift_report)
-- ---------------------------------------------------------------------------
drop policy if exists "shift_payment_entries_select" on public.shift_payment_entries;
create policy "shift_payment_entries_select" on public.shift_payment_entries
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

drop policy if exists "shift_payment_entries_write" on public.shift_payment_entries;
create policy "shift_payment_entries_insert" on public.shift_payment_entries
  for insert with check (
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
create policy "shift_payment_entries_update" on public.shift_payment_entries
  for update using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
        )
    )
  );
create policy "shift_payment_entries_delete" on public.shift_payment_entries
  for delete using (
    exists (
      select 1 from public.shift_reports sr
      where sr.id = shift_report_id
        and (
          public.is_owner()
          or (public.is_manager() and sr.shop_id = public.current_shop_id())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- audit_logs (owner only)
-- ---------------------------------------------------------------------------
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs
  for select using (public.is_owner());

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs
  for insert with check (auth.uid() is not null);

-- ============================================================================
-- STORAGE
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('payment-account-images', 'payment-account-images', true)
on conflict (id) do nothing;

drop policy if exists "payment_images_select" on storage.objects;
create policy "payment_images_select" on storage.objects
  for select using (bucket_id = 'payment-account-images');

drop policy if exists "payment_images_insert" on storage.objects;
create policy "payment_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-account-images'
    and (public.is_owner() or public.is_manager())
  );

drop policy if exists "payment_images_update" on storage.objects;
create policy "payment_images_update" on storage.objects
  for update using (
    bucket_id = 'payment-account-images'
    and (public.is_owner() or public.is_manager())
  );

drop policy if exists "payment_images_delete" on storage.objects;
create policy "payment_images_delete" on storage.objects
  for delete using (
    bucket_id = 'payment-account-images'
    and (public.is_owner() or public.is_manager())
  );

-- ============================================================================
-- SEED DATA - games and default cost percentages
-- ============================================================================

insert into public.games (game_code, game_name, is_active) values
  ('JW',  'Juwa', true),
  ('JW2', 'Juwa 2', true),
  ('FK',  'Fire Kirin', true),
  ('MW',  'Milky Way', true),
  ('GV',  'Game Vault', true),
  ('OS',  'Orion Stars', true),
  ('UP',  'Ultra Panda', true),
  ('VR',  'Vegas Roll', true),
  ('CF',  'Cash Frenzy', true),
  ('PD',  'Panda Master', true)
on conflict (game_code) do update set game_name = excluded.game_name, is_active = true;

insert into public.game_settings (game_code, game_name, cost_percentage, is_active) values
  ('GV',  'Game Vault', 12, true),
  ('CF',  'Cash Frenzy', 10, true),
  ('PD',  'Panda Master', 12, true),
  ('MW',  'Milky Way', 13, true),
  ('OS',  'Orion Stars', 15, true),
  ('FK',  'Fire Kirin', 12, true),
  ('JW',  'Juwa', 11, true),
  ('JW2', 'Juwa 2', 12, true),
  ('UP',  'Ultra Panda', 10, true),
  ('VR',  'Vegas Roll', 10, true)
on conflict (game_code) do update set cost_percentage = excluded.cost_percentage, game_name = excluded.game_name;

-- ============================================================================
-- Done. Next steps:
-- 1. Sign up the first user in the app - they automatically become the Owner.
-- 2. As Owner, create shops, managers, and employees from the portal.
-- ============================================================================
