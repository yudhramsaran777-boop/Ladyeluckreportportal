-- ============================================================================
-- Lady E Luck Portal – Add payment_link to payment_accounts
-- Also sets sensible defaults for status on payment_accounts and game_accounts.
-- ============================================================================

alter table public.payment_accounts
  add column if not exists payment_link text;

alter table public.payment_accounts
  alter column status set default 'active';

alter table public.game_accounts
  alter column status set default 'active';

notify pgrst, 'reload schema';
