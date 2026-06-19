-- ============================================================================
-- Lady E Luck Portal — Migration 0017
-- Payment System: performance indexes
-- Depends on: 0015 (payment schema)
-- All use IF NOT EXISTS — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- shop_feature_flags
-- Primary lookup: by shop_id (unique constraint already creates a btree index,
-- but we add an explicit named one for clarity and monitoring).
-- ---------------------------------------------------------------------------
create index if not exists idx_shop_feature_flags_shop_id
  on public.shop_feature_flags(shop_id);

-- ---------------------------------------------------------------------------
-- gmail_connections
-- ---------------------------------------------------------------------------
-- Look up connection by shop to show status in the manager UI
create index if not exists idx_gmail_connections_shop_id
  on public.gmail_connections(shop_id);

-- Look up connection by payment_account_id (most common webhook lookup path)
create index if not exists idx_gmail_connections_payment_account_id
  on public.gmail_connections(payment_account_id);

-- Webhook handler looks up by email_address to route inbound notifications
create index if not exists idx_gmail_connections_email_address
  on public.gmail_connections(email_address);

-- Watch renewal job: find connections expiring soon
create index if not exists idx_gmail_connections_watch_expires_at
  on public.gmail_connections(watch_expires_at)
  where connection_status = 'connected';

-- ---------------------------------------------------------------------------
-- payment_email_events
-- ---------------------------------------------------------------------------
-- Dedup check: gmail_message_id unique constraint already indexes this,
-- but add shop_id for fast per-shop queries
create index if not exists idx_payment_email_events_shop_id
  on public.payment_email_events(shop_id);

-- Connection lookup for per-account event history
create index if not exists idx_payment_email_events_gmail_connection_id
  on public.payment_email_events(gmail_connection_id);

-- Body-hash dedup lookup: same hash within same shop+provider
create index if not exists idx_payment_email_events_body_hash
  on public.payment_email_events(shop_id, body_hash)
  where body_hash is not null;

-- ---------------------------------------------------------------------------
-- payment_transactions
-- ---------------------------------------------------------------------------
-- Employee dashboard: all counted transactions for a shop ordered by date
create index if not exists idx_payment_transactions_shop_occurred_at
  on public.payment_transactions(shop_id, occurred_at desc);

-- Employee view: shop + counted + status filter
create index if not exists idx_payment_transactions_shop_counted_status
  on public.payment_transactions(shop_id, is_counted, status);

-- Manager overview: shop + date range aggregation
create index if not exists idx_payment_transactions_shop_id
  on public.payment_transactions(shop_id);

-- Tag matching: look up existing mapping when transaction arrives
create index if not exists idx_payment_transactions_normalized_tag
  on public.payment_transactions(shop_id, provider, normalized_customer_payment_tag)
  where normalized_customer_payment_tag is not null;

-- Recharge lookup: find transaction by id quickly (FK, already indexed by PK)
-- Also index by payment_account_id for account-level history
create index if not exists idx_payment_transactions_payment_account_id
  on public.payment_transactions(payment_account_id);

-- ---------------------------------------------------------------------------
-- player_payment_tags
-- ---------------------------------------------------------------------------
-- Tag matching: (shop_id, provider, normalized_payment_tag) — unique constraint
-- already creates an index, but add named one for monitoring
create index if not exists idx_player_payment_tags_shop_provider_tag
  on public.player_payment_tags(shop_id, provider, normalized_payment_tag);

-- Manager verification queue: unverified tags by shop
create index if not exists idx_player_payment_tags_verification_status
  on public.player_payment_tags(shop_id, verification_status)
  where verification_status = 'employee_added';

-- ---------------------------------------------------------------------------
-- payment_recharges
-- ---------------------------------------------------------------------------
-- Per-transaction recharge check (prevent duplicates)
create index if not exists idx_payment_recharges_transaction_id
  on public.payment_recharges(payment_transaction_id)
  where recharge_status != 'voided';

-- Employee history: recharges by shop ordered by date
create index if not exists idx_payment_recharges_shop_created_at
  on public.payment_recharges(shop_id, created_at desc);

-- Employee's own recharges
create index if not exists idx_payment_recharges_employee_id
  on public.payment_recharges(employee_id, created_at desc)
  where employee_id is not null;

-- ---------------------------------------------------------------------------
-- payment_audit_logs
-- ---------------------------------------------------------------------------
-- Manager audit view: all entries for a shop ordered by time
create index if not exists idx_payment_audit_logs_shop_performed_at
  on public.payment_audit_logs(shop_id, performed_at desc);

-- Filter by entity type + id (e.g. all actions on a specific transaction)
create index if not exists idx_payment_audit_logs_entity
  on public.payment_audit_logs(entity_type, entity_id)
  where entity_id is not null;
