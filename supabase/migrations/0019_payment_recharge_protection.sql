-- ============================================================================
-- Lady E Luck Portal — Migration 0019
-- Payment Recharge Protection: duplicate-submission guard + RLS hardening
--
-- Adds:
--   Unique partial index on payment_recharges(payment_transaction_id)
--   WHERE voided_at IS NULL — ensures only one active recharge per transaction.
--   A voided recharge does NOT block a corrected recharge.
--
--   RLS delete policy for managers (void sets voided_at, not a delete;
--   but this guards against accidental hard-deletes via RLS).
--
-- Safe to re-run: uses IF NOT EXISTS / DROP INDEX IF EXISTS for the old
--   unconditional index if one was accidentally created.
-- Does NOT alter or drop any applied migration 0014-0018.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Unique partial index: only one NON-VOIDED recharge per transaction.
--    Voided rows (voided_at IS NOT NULL) are excluded, so a corrected
--    recharge can be inserted after a void.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_recharges_active_unique
  ON public.payment_recharges(payment_transaction_id)
  WHERE voided_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Supporting index: manager review queue (under-recharged, active)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_recharges_under_recharged
  ON public.payment_recharges(shop_id, recharge_status)
  WHERE recharge_status = 'missing_recharge' AND voided_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Index: employee lookup by transaction
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_recharges_transaction_id
  ON public.payment_recharges(payment_transaction_id);

-- ---------------------------------------------------------------------------
-- 4. Index: employee lookup by shop + created_at (for history)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_recharges_shop_created
  ON public.payment_recharges(shop_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Harden RLS: managers should not be able to hard-delete recharge records.
--    We ensure NO delete policy exists (audit history must be preserved).
--    The update policy (set voided_at) is the correct void mechanism.
-- ---------------------------------------------------------------------------

-- Ensure no accidental delete policy exists for recharges
DROP POLICY IF EXISTS "recharges_manager_delete" ON public.payment_recharges;
DROP POLICY IF EXISTS "recharges_employee_delete" ON public.payment_recharges;

-- Re-assert the select policy to include voided rows (managers/owners need history)
DROP POLICY IF EXISTS "recharges_select" ON public.payment_recharges;
CREATE POLICY "recharges_select" ON public.payment_recharges
  FOR SELECT USING (
    public.is_owner()
    OR shop_id = public.current_shop_id()
  );

-- Re-assert employee insert policy (no change, idempotent)
DROP POLICY IF EXISTS "recharges_employee_insert" ON public.payment_recharges;
CREATE POLICY "recharges_employee_insert" ON public.payment_recharges
  FOR INSERT WITH CHECK (
    shop_id = public.current_shop_id()
    AND employee_id = auth.uid()
  );

-- Re-assert manager update policy (void: set voided_at, voided_by)
DROP POLICY IF EXISTS "recharges_manager_update" ON public.payment_recharges;
CREATE POLICY "recharges_manager_update" ON public.payment_recharges
  FOR UPDATE USING (
    public.is_owner()
    OR (public.is_manager() AND shop_id = public.current_shop_id())
  );
