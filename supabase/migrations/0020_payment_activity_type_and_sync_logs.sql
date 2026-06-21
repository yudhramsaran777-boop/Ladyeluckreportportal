-- ============================================================================
-- Lady E Luck Portal — Migration 0020
-- Payment System: activity_type column, expanded status values, payment_note,
--                 and payment_sync_logs table.
--
-- Adds to payment_transactions:
--   activity_type  text  - canonical 6-way classification of each notification
--   payment_note   text  - memo/note from the payment email (nullable)
--
-- Expands payment_transactions.status check constraint to add:
--   needs_review | failed | refunded | duplicate | canceled
-- (existing values pending/confirmed/rejected/voided are preserved)
--
-- Adds table: payment_sync_logs
--   Records every sync run for diagnostics and manager visibility.
--
-- Adds table: payment_tag_link_audit
--   Append-only audit trail for player-tag assignment changes.
--
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DO blocks.
-- Does NOT alter or drop any applied migration 0001-0019.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add activity_type column to payment_transactions
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS activity_type text;

-- Named constraint so it can be safely dropped and re-added on re-run.
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_activity_type_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_activity_type_check
  CHECK (activity_type IN (
    'incoming',
    'outgoing',
    'request_sent',
    'request_received',
    'refunded',
    'failed'
  ));

-- Back-fill existing rows using the direction column as a proxy.
-- incoming ≈ direction='received', outgoing ≈ direction='sent'.
-- New ingestion always sets activity_type explicitly.
UPDATE public.payment_transactions
SET activity_type = CASE direction
  WHEN 'received' THEN 'incoming'
  WHEN 'sent'     THEN 'outgoing'
  ELSE NULL
END
WHERE activity_type IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Add payment_note column to payment_transactions
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS payment_note text;

-- ---------------------------------------------------------------------------
-- 3. Expand the status check constraint
--    Drop any existing status constraint (named or from a prior partial run),
--    then re-add with the full set of allowed values.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'rejected',
    'voided',
    'needs_review',
    'failed',
    'refunded',
    'duplicate',
    'canceled'
  ));

-- ---------------------------------------------------------------------------
-- 4. Index: activity_type for manager totals and employee filtering
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_transactions_activity_type
  ON public.payment_transactions(shop_id, activity_type, status);

-- ---------------------------------------------------------------------------
-- 5. TABLE: payment_sync_logs
--    Records each Gmail history sync run — push-notification-triggered and
--    reconciliation. Manager/owner can read; no browser insert.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_sync_logs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  gmail_connection_id   uuid        REFERENCES public.gmail_connections(id) ON DELETE SET NULL,
  sync_type             text        NOT NULL
                          CHECK (sync_type IN (
                            'push_notification',
                            'reconciliation',
                            'manual',
                            'watch_renewal'
                          )),
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  status                text        NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running','completed','failed')),
  emails_found          integer     NOT NULL DEFAULT 0,
  emails_processed      integer     NOT NULL DEFAULT 0,
  records_created       integer     NOT NULL DEFAULT 0,
  records_skipped       integer     NOT NULL DEFAULT 0,
  errors_found          integer     NOT NULL DEFAULT 0,
  error_summary         text,
  history_id_start      text,
  history_id_end        text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_sync_logs_shop_id
  ON public.payment_sync_logs(shop_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_sync_logs_connection_id
  ON public.payment_sync_logs(gmail_connection_id, started_at DESC)
  WHERE gmail_connection_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. TABLE: payment_tag_link_audit
--    Append-only history of every player-tag assignment change.
--    Employees cannot read. Managers can read their own shop's entries.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_tag_link_audit (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  payment_tag_link_id      uuid        REFERENCES public.player_payment_tags(id) ON DELETE SET NULL,
  provider                 text,
  payment_tag              text,
  old_player_name          text,
  old_player_id            uuid,
  old_verification_status  text,
  new_player_name          text,
  new_player_id            uuid,
  new_verification_status  text,
  action                   text        NOT NULL
                             CHECK (action IN (
                               'created',
                               'player_assigned',
                               'player_updated',
                               'player_removed',
                               'verified',
                               'blocked',
                               'unblocked',
                               'inactivated',
                               'reactivated'
                             )),
  changed_by               uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tag_link_audit_shop_id
  ON public.payment_tag_link_audit(shop_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_tag_link_audit_link_id
  ON public.payment_tag_link_audit(payment_tag_link_id, changed_at DESC)
  WHERE payment_tag_link_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. RLS on new tables
-- ---------------------------------------------------------------------------

-- payment_sync_logs: manager/owner read only; no browser insert (server only)
ALTER TABLE public.payment_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_logs_select" ON public.payment_sync_logs;
CREATE POLICY "sync_logs_select" ON public.payment_sync_logs
  FOR SELECT USING (
    public.is_owner()
    OR (public.is_manager() AND shop_id = public.current_shop_id())
  );

-- payment_tag_link_audit: manager/owner read; any authenticated user insert
-- (server actions write on behalf of user)
ALTER TABLE public.payment_tag_link_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_link_audit_select" ON public.payment_tag_link_audit;
CREATE POLICY "tag_link_audit_select" ON public.payment_tag_link_audit
  FOR SELECT USING (
    public.is_owner()
    OR (public.is_manager() AND shop_id = public.current_shop_id())
  );

DROP POLICY IF EXISTS "tag_link_audit_insert" ON public.payment_tag_link_audit;
CREATE POLICY "tag_link_audit_insert" ON public.payment_tag_link_audit
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 8. Update payment_transactions employee RLS to include new activity types.
--    Employees see: confirmed/pending + activity_type in (incoming, outgoing)
--    AND is_counted = true. New types (requests, failed, refunded) are
--    manager/owner only UNLESS is_counted = true (for edge cases).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "transactions_employee_select" ON public.payment_transactions;
CREATE POLICY "transactions_employee_select" ON public.payment_transactions
  FOR SELECT USING (
    public.is_owner()
    OR (public.is_manager() AND shop_id = public.current_shop_id())
    OR (
      -- Employee: can see confirmed/pending rows that are counted
      shop_id = public.current_shop_id()
      AND status IN ('confirmed', 'pending')
      AND is_counted = true
    )
  );

-- ============================================================================
-- Migration 0020 complete.
-- ============================================================================
