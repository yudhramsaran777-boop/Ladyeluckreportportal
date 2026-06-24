-- ============================================================================
-- Lady E Luck Portal — Migration 0024
-- Gmail Payment Backend: additive compatibility layer
--
-- CONTEXT:
--   Migrations 0015–0020 created the full payment schema (gmail_connections,
--   payment_email_senders, payment_email_events, payment_transactions, etc.).
--   Migration 0023 revoked browser-role (anon/authenticated) access and
--   disabled all feature flags — data was preserved.
--
--   This migration adds the one missing column required by the new
--   isolated-module backend (parser confidence score), re-enables
--   service-role access patterns (no RLS changes needed — service-role
--   bypasses RLS), and re-grants the minimal SELECT needed for
--   payment_email_senders so the server can read the active senders list.
--
-- WHAT THIS DOES:
--   1. Adds payment_transactions.confidence (numeric 0–1, nullable).
--   2. Re-grants SELECT on payment_email_senders to authenticated role
--      (required for server-side sender validation reads via admin client —
--      admin client bypasses RLS, but explicit GRANTs are still needed for
--      the underlying Postgres role to read the table).
--      NOTE: The REVOKE in 0023 was "REVOKE SELECT ... FROM authenticated",
--      which removes the table-level privilege. The admin/service-role client
--      uses the postgres superuser role which is unaffected by this, BUT we
--      document this clearly here. If your Supabase setup uses a separate
--      service_role Postgres user (not postgres/superuser), you may need the
--      GRANT below. It is safe to run regardless.
--   3. Adds a comment replacing the discontinued-marker on gmail_connections
--      to reflect active-backend status.
--
-- WHAT THIS DOES NOT DO:
--   - Does NOT drop any table.
--   - Does NOT delete any rows.
--   - Does NOT remove any constraint or index.
--   - Does NOT modify any applied migration (0001–0023).
--   - Does NOT re-enable feature flags (those require explicit owner action).
--   - Does NOT restore browser-role access to payment data tables.
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add confidence column to payment_transactions
--    Range: 0.0 (lowest) to 1.0 (highest). NULL = not yet scored.
--    The parser sets this based on how many required fields were found.
--    Transactions are only counted (is_counted=true) when confidence is high.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS confidence numeric
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

-- Index: fast queries for review queue (low confidence = needs_review)
CREATE INDEX IF NOT EXISTS idx_payment_transactions_confidence
  ON public.payment_transactions(shop_id, confidence, status)
  WHERE confidence IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Ensure service-role can read payment_email_senders for sender validation.
--    The admin client uses the service_role key which has BYPASSRLS and
--    superuser-equivalent access in Supabase — this GRANT is a safety net
--    for environments where that is not the case.
-- ---------------------------------------------------------------------------

-- Re-grant SELECT on payment_email_senders to authenticated and service_role
-- (0023 revoked all; we only restore the minimum for server-side reads).
-- Browser (authenticated role via RLS) still cannot read this table because
-- the RLS policy "senders_select" from 0016 requires auth.uid() IS NOT NULL,
-- and the REVOKE in 0023 removed the table-level privilege entirely.
-- We selectively restore only what the backend needs.

-- The service_role in Supabase is a Postgres role; grant it directly.
DO $$
BEGIN
  -- Only run if the role exists (it does in all Supabase projects)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON public.payment_email_senders TO service_role;
    GRANT SELECT ON public.gmail_connections TO service_role;
    GRANT SELECT, INSERT, UPDATE ON public.payment_email_events TO service_role;
    GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO service_role;
    GRANT SELECT, INSERT ON public.payment_audit_logs TO service_role;
    GRANT SELECT, INSERT, UPDATE ON public.payment_sync_logs TO service_role;
    GRANT SELECT, INSERT, UPDATE ON public.gmail_connections TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Update table comments to reflect active-backend status
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.gmail_connections IS
  'Gmail OAuth connections for payment email ingestion. '
  'Browser access remains revoked (migration 0023). '
  'Server-side access via service-role admin client is active (migration 0024). '
  'Tokens are AES-256-GCM encrypted — never returned to any browser client.';

COMMENT ON TABLE public.payment_email_senders IS
  'Known CashApp/Chime sender addresses. All rows start with is_active=false. '
  'Owner must manually set is_active=true AND verification_status=verified '
  'before any email from that address will be processed. '
  'Browser access revoked (0023). Server reads via service-role (0024).';

COMMENT ON COLUMN public.payment_transactions.confidence IS
  'Parser confidence score (0.0–1.0). Set by the email parser. '
  'Transactions are only counted (is_counted=true) when confidence=1.0 and '
  'all required fields (sender, direction, amount, occurred_at) are present. '
  'NULL = not yet scored. Values below 1.0 go to needs_review.';

-- ============================================================================
-- Migration 0024 complete.
-- ============================================================================
