-- ============================================================================
-- Migration: 0023_disable_payment_activity_system.sql
-- Purpose:   Non-destructive cleanup after discontinuing the Gmail/live-payment
--            activity system.
--
-- WHAT THIS DOES:
--   1. Sets all payment feature flags to false so no shop can accidentally
--      enable the discontinued system.
--   2. Revokes anon/authenticated browser access to the discontinued tables
--      (data is preserved; the app simply cannot query them any more).
--   3. Adds explanatory comments on each retained table.
--
-- WHAT THIS DOES NOT DO:
--   - Does NOT drop any table.
--   - Does NOT delete any rows.
--   - Does NOT remove foreign keys or indexes.
--   - Does NOT affect payment_accounts, shift_reports, shops, profiles, or
--     any other table used by the original portal.
--
-- ROLLBACK NOTE:
--   To re-enable a flag, run:
--     UPDATE public.shop_feature_flags
--       SET payment_dashboard_enabled = true   -- or whichever flag
--     WHERE shop_id = '<shop-uuid>';
--   To restore browser access, GRANT SELECT on the relevant table to
--   authenticated and/or anon roles.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Disable all payment-system feature flags for every shop.
--    Rows that already have all flags false are unaffected (idempotent).
-- ---------------------------------------------------------------------------
UPDATE public.shop_feature_flags
SET
  payment_dashboard_enabled        = false,
  gmail_sync_enabled               = false,
  manager_payment_summary_enabled  = false,
  updated_at                       = now()
WHERE
  payment_dashboard_enabled        = true
  OR gmail_sync_enabled            = true
  OR manager_payment_summary_enabled = true;

-- ---------------------------------------------------------------------------
-- 2. Revoke browser-role (anon + authenticated) SELECT on discontinued tables.
--    The service-role key used by server-side code retains full access, so
--    existing data is preserved and can be exported or restored at any time.
-- ---------------------------------------------------------------------------

-- Gmail OAuth / push notification tables
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.gmail_connections
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.payment_email_senders
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.payment_email_events
  FROM anon, authenticated;

-- Payment transaction and player-mapping tables
REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.payment_transactions
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.player_payment_tags
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.payment_recharges
  FROM anon, authenticated;

-- Audit and feature-flag tables (keep feature-flags SELECT so the app can
-- safely call getPaymentFeatureFlags and always receive false)
REVOKE INSERT, UPDATE, DELETE
  ON public.payment_audit_logs
  FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comment each discontinued table for future reference.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.shop_feature_flags IS
  'Payment-system feature flags. All flags set to false as of migration 0023. '
  'The Gmail / live-payment-activity system was discontinued by owner decision. '
  'Do not re-enable without a new owner decision.';

COMMENT ON TABLE public.gmail_connections IS
  'DISCONTINUED (migration 0023). Stored Gmail OAuth tokens for payment email '
  'ingestion. Browser access revoked. Data retained for rollback/audit history.';

COMMENT ON TABLE public.payment_email_senders IS
  'DISCONTINUED (migration 0023). Known CashApp/Chime sender addresses used by '
  'the Gmail ingestion pipeline. Browser access revoked. Data retained.';

COMMENT ON TABLE public.payment_email_events IS
  'DISCONTINUED (migration 0023). Raw Gmail push-notification event log. '
  'Browser access revoked. Data retained for audit history.';

COMMENT ON TABLE public.payment_transactions IS
  'DISCONTINUED (migration 0023). Parsed payment transactions from Gmail emails. '
  'Browser access revoked. Data retained for rollback/audit history.';

COMMENT ON TABLE public.player_payment_tags IS
  'DISCONTINUED (migration 0023). Employee-added player↔payment-tag mappings. '
  'Browser access revoked. Data retained for rollback/audit history.';

COMMENT ON TABLE public.payment_recharges IS
  'DISCONTINUED (migration 0023). Recharge records linked to payment transactions. '
  'Browser access revoked. Data retained for rollback/audit history.';

COMMENT ON TABLE public.payment_audit_logs IS
  'DISCONTINUED (migration 0023). Audit log for player-mapping mutations. '
  'Browser write access revoked. Data retained for rollback/audit history.';
