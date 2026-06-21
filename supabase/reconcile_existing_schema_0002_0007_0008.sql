-- ============================================================================
-- Lady E Luck Portal
-- reconcile_existing_schema_0002_0007_0008.sql
--
-- Reconciles the live production database with the intended final state of
-- migrations 0002, 0007, and 0008, which were not (or only partially) applied.
--
-- WHAT THIS DOES
--   1. Drops the legacy payment_images_* storage policies left over from 0001
--      (migration 0007 should have removed these)
--   2. Makes profiles.role nullable and removes its default (migration 0002)
--   3. Creates the four payment_account_images_* storage policies using the
--      exact definitions from migration 0008
--
-- WHAT THIS DOES NOT DO
--   - Delete any application data or user records
--   - Modify or remove the payment-account-images storage bucket or its files
--   - Alter the supabase/migrations/0001–0013 files
--
-- SAFETY
--   All DROP POLICY statements use IF EXISTS — safe to run even if the named
--   policy does not exist.
--   Run verify_existing_migrations_0001_0013.sql afterward to confirm
--   all checks PASS.
--   To undo, run reconcile_existing_schema_0002_0007_0008_rollback.sql.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Remove legacy payment_images_* storage policies (0001 leftovers)
--    Migration 0007 was supposed to drop these; they should not exist.
-- ============================================================================

DROP POLICY IF EXISTS "payment_images_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_images_update" ON storage.objects;
DROP POLICY IF EXISTS "payment_images_delete" ON storage.objects;

-- ============================================================================
-- 2. Make profiles.role nullable with no default (migration 0002)
--
--    Why: The handle_new_user() trigger already inserts role = null for new
--    auth.users rows (migration 0002 updated the trigger body).  The column
--    still carries NOT NULL + DEFAULT 'employee', so any new auth user created
--    via the Supabase Auth dashboard after the trigger change will hit a NOT
--    NULL constraint violation.  Removing the constraint and default aligns
--    the column with the trigger behaviour.
--
--    The existing CHECK constraint (role IN ('owner','manager','employee'))
--    evaluates to NULL — not FALSE — when role is null, so null values already
--    satisfy it.  No constraint change is needed.
--
--    Application compatibility:
--      - All role checks use === / !== comparisons that behave correctly with
--        null (null !== 'owner' → redirects away; null !== 'manager' → same).
--      - createUserByOwner always upserts an explicit role value; no code path
--        relies on the database default.
--      - TypeScript types (Role | null in Profile) should be updated in a
--        separate commit to reflect the now-nullable column.
-- ============================================================================

ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- ============================================================================
-- 3. Recreate payment_account_images_* storage policies (migration 0008 exact)
--    DROP IF EXISTS first so this block is safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "payment_account_images_select" ON storage.objects;
CREATE POLICY "payment_account_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-account-images');

DROP POLICY IF EXISTS "payment_account_images_insert" ON storage.objects;
CREATE POLICY "payment_account_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "payment_account_images_update" ON storage.objects;
CREATE POLICY "payment_account_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  ) WITH CHECK (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "payment_account_images_delete" ON storage.objects;
CREATE POLICY "payment_account_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'payment-account-images'
    AND auth.role() = 'authenticated'
  );

-- ============================================================================
-- VERIFICATION — read-only checks to confirm expected post-reconcile state
-- ============================================================================

-- profiles.role should now be nullable with no default
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  = 'role';
-- Expected: is_nullable = YES, column_default = NULL

-- Legacy payment_images_* policies should be gone (count = 0)
SELECT COUNT(*) AS legacy_policies_remaining
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
  AND policyname LIKE 'payment_images_%';
-- Expected: 0

-- New payment_account_images_* policies should be present (4 rows)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
  AND policyname LIKE 'payment_account_images_%'
ORDER BY policyname;
-- Expected: payment_account_images_delete/insert/select/update

-- Bucket must still exist with all files intact
SELECT id, name, public
FROM storage.buckets
WHERE id = 'payment-account-images';
-- Expected: 1 row, public = true

COMMIT;
