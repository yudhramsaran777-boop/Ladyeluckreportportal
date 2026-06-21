-- ============================================================================
-- Lady E Luck Portal
-- reconcile_existing_schema_0002_0007_0008_rollback.sql
--
-- Rolls back reconcile_existing_schema_0002_0007_0008.sql, restoring the
-- database to its pre-reconcile state (as if migrations 0002, 0007, and 0008
-- had never been applied).
--
-- WARNING — READ BEFORE RUNNING
--   Step 3 restores NOT NULL on profiles.role.  This will fail if any row
--   currently has role = null.  Check first:
--
--     SELECT id, email FROM public.profiles WHERE role IS NULL;
--
--   If rows are returned, set their roles explicitly before running this file.
--   An optional UPDATE is included below (commented out) for convenience.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Remove the payment_account_images_* policies added by the reconcile
--    (restores the state before migration 0008 was applied)
-- ============================================================================

DROP POLICY IF EXISTS "payment_account_images_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_account_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_account_images_update" ON storage.objects;
DROP POLICY IF EXISTS "payment_account_images_delete" ON storage.objects;

-- ============================================================================
-- 2. Restore the legacy payment_images_* storage policies from migration 0001
--    (the reconcile removed these; this puts them back)
-- ============================================================================

DROP POLICY IF EXISTS "payment_images_select" ON storage.objects;
CREATE POLICY "payment_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-account-images');

DROP POLICY IF EXISTS "payment_images_insert" ON storage.objects;
CREATE POLICY "payment_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "payment_images_update" ON storage.objects;
CREATE POLICY "payment_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  ) WITH CHECK (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "payment_images_delete" ON storage.objects;
CREATE POLICY "payment_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

-- ============================================================================
-- 3. Restore profiles.role NOT NULL with default 'employee' (undo migration 0002)
--
--    PREREQUISITE: All profiles rows must have a non-null role.
--    Uncomment and run the UPDATE below first if any rows have role = null.
-- ============================================================================

-- UPDATE public.profiles SET role = 'employee' WHERE role IS NULL;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

COMMIT;
