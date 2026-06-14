-- ============================================================================
-- Lady E Luck Portal - Remove auto first-user-becomes-owner behavior
--
-- Background: 0001_init.sql created a handle_new_user() trigger that
-- automatically promoted the FIRST signed-up user to 'owner' and every
-- subsequent user to 'employee', with is_active = true. Public signup has
-- now been removed from the app, and the Owner account is created manually
-- via the Supabase Auth dashboard (see instructions at the bottom of this
-- file). New auth.users rows can still occur (e.g. if Supabase Auth admin
-- APIs are used), so we keep the trigger but change its behavior:
--
--   - Never auto-assign 'owner'.
--   - New profiles are created with role = null and is_active = false by
--     default, requiring the Owner to explicitly assign a role and activate
--     the account (see Part 4 - createUserByOwner server action, which sets
--     role/is_active explicitly on the profiles row it creates/updates).
--
-- profiles.role is currently `not null default 'employee'` with a check
-- constraint limiting it to ('owner','manager','employee'). Making it
-- nullable is the smaller schema change vs. introducing a new sentinel
-- value, and lets the UI distinguish "no role assigned yet" from a real
-- role. We drop the NOT NULL constraint and the default, but keep the
-- check constraint (it already allows NULL implicitly unless re-declared
-- with NOT NULL, since `check` constraints only apply to non-null values
-- by default in Postgres... actually CHECK constraints DO need NULL
-- handling - see below).
-- ============================================================================

-- Allow role to be null (new users start with no role assigned).
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;

-- The existing check constraint `role in ('owner','manager','employee')`
-- evaluates to NULL (not false) when role is null, so rows with role = null
-- already satisfy the constraint. No constraint changes are required.

-- ============================================================================
-- Replace handle_new_user(): create a profile row for every new auth user,
-- but never auto-assign 'owner' and default to role = null, is_active = false.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    null,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger definition is unchanged (still fires on auth.users insert), but
-- re-create it to ensure it points at the updated function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- MANUAL OWNER SETUP
--
-- 1. In the Supabase dashboard, go to Authentication > Users and manually
--    create the owner user (set email + password, confirm email).
-- 2. Then run the following SQL in the SQL Editor, replacing
--    OWNER_EMAIL_HERE with the owner's email address:
--
-- insert into profiles (id, email, full_name, role, is_active)
-- select id, email, 'Owner', 'owner', true from auth.users where email = 'OWNER_EMAIL_HERE'
-- on conflict (id) do update set role = 'owner', is_active = true, updated_at = now();
-- ============================================================================
