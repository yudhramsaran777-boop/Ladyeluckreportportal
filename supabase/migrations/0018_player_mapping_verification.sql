-- ============================================================================
-- Lady E Luck Portal — Migration 0018
-- Player Mapping Verification: additive columns + constraint expansion
--
-- Adds:
--   player_payment_tags.manager_review_reason  — why manager flagged/blocked
--   player_payment_tags.reviewed_at            — when manager last reviewed
--   player_payment_tags.updated_by             — last editor's profile id
--   payment_transactions.player_mapping_id     — FK to winning mapping row
--
-- Expands:
--   player_payment_tags.verification_status check constraint to include
--   needs_review, conflicting_match, inactive (were missing from 0015)
--
-- Replaces:
--   The full unique constraint on (shop_id, provider, normalized_payment_tag)
--   with a PARTIAL unique index on active mappings only, so that a blocked or
--   inactive mapping can be superseded by a new active one.
--
-- Safe to re-run: uses IF NOT EXISTS / DO blocks / DROP CONSTRAINT IF EXISTS.
-- Does NOT alter or drop any applied migration 0014-0017.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns on player_payment_tags
-- ---------------------------------------------------------------------------

ALTER TABLE public.player_payment_tags
  ADD COLUMN IF NOT EXISTS manager_review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by            uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Expand the verification_status check constraint
--    Original (0015): 'employee_added','manager_verified','blocked','unmatched'
--    New: adds needs_review, conflicting_match, inactive
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM   pg_constraint
  WHERE  conrelid = 'public.player_payment_tags'::regclass
    AND  contype  = 'c'
    AND  conname  LIKE '%verification_status%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.player_payment_tags DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.player_payment_tags
  ADD CONSTRAINT player_payment_tags_verification_status_check
  CHECK (verification_status IN (
    'unmatched',
    'employee_added',
    'manager_verified',
    'needs_review',
    'conflicting_match',
    'blocked',
    'inactive'
  ));

-- ---------------------------------------------------------------------------
-- 3. Replace the full unique constraint with a partial unique index
--    Partial index: only one ACTIVE mapping per (shop, provider, tag).
--    Inactive / blocked rows are excluded so a tag can be re-mapped later.
-- ---------------------------------------------------------------------------

-- Drop the full unique constraint created by the UNIQUE(...) clause in 0015.
-- PostgreSQL names it <table>_<col1>_<col2>_<col3>_key automatically.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM   pg_constraint
  WHERE  conrelid = 'public.player_payment_tags'::regclass
    AND  contype  = 'u'
    AND  conname  LIKE '%shop_id%provider%normalized_payment_tag%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.player_payment_tags DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Partial unique index: active mappings only
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_payment_tags_active_unique
  ON public.player_payment_tags(shop_id, provider, normalized_payment_tag)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 4. Add player_mapping_id to payment_transactions
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS player_mapping_id uuid
    REFERENCES public.player_payment_tags(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_player_mapping_id
  ON public.payment_transactions(player_mapping_id)
  WHERE player_mapping_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. RLS: allow employees to update player_match_status + player_mapping_id
--    on their own shop's counted confirmed transactions.
--    (Existing policies only covered SELECT; mutations went through admin client.
--     We still use the admin client in server actions for correctness, but this
--     policy is added as a defence-in-depth safety net.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "transactions_employee_update_match" ON public.payment_transactions;
CREATE POLICY "transactions_employee_update_match" ON public.payment_transactions
  FOR UPDATE USING (
    shop_id = public.current_shop_id()
    AND is_counted = true
    AND status IN ('confirmed', 'pending')
  )
  WITH CHECK (
    shop_id = public.current_shop_id()
  );

-- ---------------------------------------------------------------------------
-- 6. Index: speed up manager verification queue queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_player_payment_tags_needs_review
  ON public.player_payment_tags(shop_id, verification_status)
  WHERE verification_status IN ('employee_added', 'needs_review', 'conflicting_match');
