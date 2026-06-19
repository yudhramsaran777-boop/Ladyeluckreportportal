-- ============================================================================
-- Lady E Luck Portal — Migration 0015
-- Payment System: full schema
-- Creates: gmail_connections, payment_email_senders, payment_email_events,
--          payment_transactions, player_payment_tags, payment_recharges,
--          payment_audit_logs
-- Alters:  payment_accounts (adds gmail_connection_id, connection_status,
--          account_display_name, last_synced_at, updated_by)
-- Seeds:   payment_email_senders with Cash App and Chime sender addresses
--          (is_active = false until manually verified)
-- Safe to re-run: uses IF NOT EXISTS / add column IF NOT EXISTS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: gmail_connections
-- SECURITY: encrypted_access_token and encrypted_refresh_token are AES-256-GCM
-- ciphertext (base64). They are NEVER returned by any RLS policy — only the
-- service-role admin client may read them server-side.
-- ---------------------------------------------------------------------------
create table if not exists public.gmail_connections (
  id                      uuid        primary key default gen_random_uuid(),
  shop_id                 uuid        not null references public.shops(id) on delete cascade,
  payment_account_id      uuid        not null references public.payment_accounts(id) on delete cascade,
  email_address           text        not null,
  -- Token columns: AES-256-GCM encrypted, base64-encoded. Never exposed to browser.
  encrypted_access_token  text,
  encrypted_refresh_token text,
  token_iv                text,       -- per-encryption random IV for access token
  refresh_iv              text,       -- per-encryption random IV for refresh token
  token_expires_at        timestamptz,
  last_history_id         text,
  watch_expires_at        timestamptz,
  connection_status       text        not null default 'not_connected'
                            check (connection_status in (
                              'not_connected','connecting','connected',
                              'token_expired','error','disconnected'
                            )),
  last_sync_attempt_at    timestamptz,
  last_synced_at          timestamptz,
  last_error_code         text,
  last_error_message      text,
  connected_by            uuid        references public.profiles(id) on delete set null,
  connected_at            timestamptz,
  disconnected_by         uuid        references public.profiles(id) on delete set null,
  disconnected_at         timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_gmail_connections_updated_at'
  ) then
    create trigger set_gmail_connections_updated_at
      before update on public.gmail_connections
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TABLE: payment_email_senders
-- Owner-managed allowlist. Exact normalized sender email must appear here
-- with is_active = true before any email from that address is processed.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_email_senders (
  id                      uuid        primary key default gen_random_uuid(),
  provider                text        not null,
  sender_email            text        not null,
  normalized_sender_email text        not null,
  verification_status     text        not null default 'pending_verification'
                            check (verification_status in (
                              'pending_verification','verified','rejected'
                            )),
  is_active               boolean     not null default false,
  created_by              uuid        references public.profiles(id) on delete set null,
  updated_by              uuid        references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(normalized_sender_email)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_payment_email_senders_updated_at'
  ) then
    create trigger set_payment_email_senders_updated_at
      before update on public.payment_email_senders
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed: known sender addresses. All seeded as pending_verification / is_active = false.
-- Owner must manually set is_active = true after confirming the address is correct.
-- NOTE: The Chime address below uses "alers@" — confirm correct spelling
-- ("alerts@account.chime.com") before activating.
insert into public.payment_email_senders
  (provider, sender_email, normalized_sender_email, verification_status, is_active)
values
  ('CashApp', 'cash@square.com',          'cash@square.com',          'pending_verification', false),
  ('Chime',   'alerts@account.chime.com',  'alerts@account.chime.com',  'pending_verification', false)
on conflict (normalized_sender_email) do nothing;

-- ---------------------------------------------------------------------------
-- TABLE: payment_email_events
-- Records every email received via Gmail webhook — processed or rejected.
-- gmail_message_id is unique to prevent duplicate processing.
-- body_hash (SHA-256) is used for duplicate body detection within a shop+provider.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_email_events (
  id                      uuid        primary key default gen_random_uuid(),
  gmail_connection_id     uuid        references public.gmail_connections(id) on delete set null,
  shop_id                 uuid        not null references public.shops(id) on delete cascade,
  payment_account_id      uuid        references public.payment_accounts(id) on delete set null,
  gmail_message_id        text        not null,
  gmail_thread_id         text,
  sender_email            text,
  normalized_sender_email text,
  subject                 text,
  email_received_at       timestamptz,
  sender_allowed          boolean     not null default false,
  authentication_status   text,       -- 'pass' | 'fail' | 'unknown'
  parse_status            text        not null default 'pending'
                            check (parse_status in (
                              'pending','parsed','parse_failed','rejected','duplicate'
                            )),
  rejection_reason        text,
  body_hash               text,       -- SHA-256 of sanitized email body text
  processed_at            timestamptz,
  created_at              timestamptz not null default now(),
  unique(gmail_message_id)
);

-- ---------------------------------------------------------------------------
-- TABLE: payment_transactions
-- One row per parsed payment. Inserted server-side only (admin client).
-- Employees may read confirmed+counted transactions for their own shop only
-- (enforced in RLS). Aggregate totals are never returned to employee browsers.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id                              uuid        primary key default gen_random_uuid(),
  shop_id                         uuid        not null references public.shops(id) on delete cascade,
  payment_account_id              uuid        references public.payment_accounts(id) on delete set null,
  email_event_id                  uuid        references public.payment_email_events(id) on delete set null,
  provider                        text        not null check (provider in ('CashApp','Chime')),
  provider_transaction_id         text,
  direction                       text        not null check (direction in ('received','sent')),
  amount                          numeric     not null check (amount >= 0),
  customer_name                   text,
  customer_payment_tag            text,
  normalized_customer_payment_tag text,
  status                          text        not null default 'confirmed'
                                    check (status in ('pending','confirmed','rejected','voided')),
  is_counted                      boolean     not null default false,
  occurred_at                     timestamptz not null,
  player_match_status             text        not null default 'unmatched'
                                    check (player_match_status in (
                                      'unmatched','matched','multiple_matches','needs_review'
                                    )),
  review_reason                   text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_payment_transactions_updated_at'
  ) then
    create trigger set_payment_transactions_updated_at
      before update on public.payment_transactions
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TABLE: player_payment_tags
-- Maps a payment tag (e.g. $PlayerName) to a known player.
-- Employee can add (verification_status = 'employee_added').
-- Manager must verify (verification_status = 'manager_verified') before
-- the tag is used for automatic player matching.
-- ---------------------------------------------------------------------------
create table if not exists public.player_payment_tags (
  id                  uuid        primary key default gen_random_uuid(),
  shop_id             uuid        not null references public.shops(id) on delete cascade,
  provider            text        not null check (provider in ('CashApp','Chime')),
  payment_tag         text        not null,
  normalized_payment_tag text     not null,
  player_id           uuid,
  player_name         text,
  facebook_name       text,
  game_username       text,
  primary_game        text,
  internal_note       text,
  verification_status text        not null default 'employee_added'
                        check (verification_status in (
                          'employee_added','manager_verified','blocked','unmatched'
                        )),
  status              text        not null default 'active'
                        check (status in ('active','inactive')),
  added_by            uuid        references public.profiles(id) on delete set null,
  verified_by         uuid        references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(shop_id, provider, normalized_payment_tag)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_player_payment_tags_updated_at'
  ) then
    create trigger set_player_payment_tags_updated_at
      before update on public.player_payment_tags
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TABLE: payment_recharges
-- One recharge record per counted transaction.
-- cash_received is ALWAYS copied from payment_transactions.amount at insert
-- time server-side — the client-supplied value is ignored.
-- Voiding requires manager/owner role.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_recharges (
  id                      uuid        primary key default gen_random_uuid(),
  shop_id                 uuid        not null references public.shops(id) on delete cascade,
  payment_transaction_id  uuid        not null references public.payment_transactions(id) on delete restrict,
  employee_id             uuid        references public.profiles(id) on delete set null,
  player_id               uuid,
  game_id                 uuid        references public.games(id) on delete set null,
  game_username           text,
  -- cash_received is locked to transaction.amount. Client value is never trusted.
  cash_received           numeric     not null check (cash_received >= 0),
  coins_recharged         numeric     not null check (coins_recharged >= 0),
  -- bonus_given   = GREATEST(coins_recharged - cash_received, 0)
  -- missing_recharge = GREATEST(cash_received - coins_recharged, 0)
  bonus_given             numeric     not null default 0 check (bonus_given >= 0),
  missing_recharge        numeric     not null default 0 check (missing_recharge >= 0),
  recharge_status         text        not null
                            check (recharge_status in (
                              'exact','bonus_given','missing_recharge','voided'
                            )),
  notes                   text,
  voided_at               timestamptz,
  voided_by               uuid        references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_payment_recharges_updated_at'
  ) then
    create trigger set_payment_recharges_updated_at
      before update on public.payment_recharges
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TABLE: payment_audit_logs
-- Append-only audit trail for all payment-system actions.
-- Employees cannot read. Managers can read their own shop's entries.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  shop_id      uuid        not null references public.shops(id) on delete cascade,
  entity_type  text        not null,
  entity_id    uuid,
  action       text        not null,
  old_values   jsonb,
  new_values   jsonb,
  performed_by uuid        references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ALTER TABLE payment_accounts
-- Adds Gmail connection metadata columns.
-- payment_link already exists from migration 0005 — not re-added.
-- ---------------------------------------------------------------------------
alter table public.payment_accounts
  add column if not exists account_display_name text,
  add column if not exists gmail_connection_id  uuid
    references public.gmail_connections(id) on delete set null,
  add column if not exists connection_status     text not null default 'not_connected',
  add column if not exists last_synced_at        timestamptz,
  add column if not exists updated_by            uuid
    references public.profiles(id) on delete set null;
