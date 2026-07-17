-- ============================================================================
-- Lady E Luck Portal
-- verify_existing_migrations_0001_0013.sql
--
-- READ-ONLY audit of the live database against migrations 0001 – 0013.
-- Safe to paste directly into the Supabase SQL Editor.
--
-- HOW TO USE
--   Select PART 1 and click Run  → per-object check rows (migration /
--     object_type / object_name / expected_state / actual_state / result).
--   Select PART 2 and click Run  → per-migration pass / fail summary.
--
-- WHAT IS CHECKED
--   Extensions · tables · columns (data_type, is_nullable, default presence)
--   FK constraints · CHECK constraints · indexes · functions (existence +
--   security_definer) · triggers · RLS enabled flags · RLS policies (name +
--   command) · storage bucket · seed-data row counts · data-formula
--   consistency for the 0012 / 0013 data-only migrations.
--
-- WHAT IS NOT CHECKED
--   RLS policy USING / WITH CHECK expressions — not stored in a single
--   queryable catalog column; use pg_get_expr(polqual, polrelid) for that.
--   Data values normalised by UPDATE statements in migrations 0008 – 0013.
--
-- POLICY ATTRIBUTION NOTE
--   Several policies were replaced across multiple migrations.  Each policy
--   is attributed to the LAST migration that created it (i.e. the version
--   that must exist in the live database).  Earlier intermediate versions
--   are not re-checked.
--
-- NO WRITES — this file contains zero CREATE / ALTER / DROP / INSERT /
-- UPDATE / DELETE / GRANT / REVOKE statements.
-- ============================================================================


-- ============================================================================
-- PART 1 — Detailed per-object checks (run this section alone)
-- ============================================================================

WITH checks AS (

  --------------------------------------------------------------------------
  -- 0001 · EXTENSION
  --------------------------------------------------------------------------
  SELECT '0001'::text      AS migration
       , 'EXTENSION'::text AS object_type
       , 'pgcrypto'::text  AS object_name
       , 'installed'::text AS expected_state
       , COALESCE(
           (SELECT 'installed' FROM pg_extension WHERE extname = 'pgcrypto'),
           'missing')      AS actual_state

  --------------------------------------------------------------------------
  -- 0001 · TABLES
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','TABLE','public.profiles','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shops','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shops') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shop_members','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shop_members') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.games','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='games') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.game_settings','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='game_settings') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.payment_accounts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_accounts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.game_accounts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='game_accounts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.page_sources','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='page_sources') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_reports','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_reports') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_game_entries','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_game_entries') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_cashouts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_cashouts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_payment_entries','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_payment_entries') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.audit_logs','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · FK CONSTRAINT
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','FK_CONSTRAINT','profiles.shop_id → shops.id (profiles_shop_id_fkey)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema='public' AND table_name='profiles'
        AND constraint_name='profiles_shop_id_fkey'
        AND constraint_type='FOREIGN KEY')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · CHECK CONSTRAINTS
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','CHECK_CONSTRAINT','profiles.role IN (owner,manager,employee)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='profiles'
        AND cu.column_name='role' AND cc.check_clause LIKE '%owner%')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','CHECK_CONSTRAINT','shop_members.role IN (manager,employee)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='shop_members'
        AND cu.column_name='role' AND cc.check_clause LIKE '%manager%')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','CHECK_CONSTRAINT','payment_accounts.payment_type IN (CashApp,Chime)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='payment_accounts'
        AND cu.column_name='payment_type' AND cc.check_clause LIKE '%CashApp%')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — profiles
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','profiles.id  type=uuid','uuid',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.email  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.is_active  default=has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0001','COLUMN','profiles.shop_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='shop_id'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.created_at  type=timestamp with time zone','timestamp with time zone',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='created_at'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.updated_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='updated_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shops
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shops.name  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='name'),'missing')

  UNION ALL SELECT '0001','COLUMN','shops.status  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='status'),'missing')

  UNION ALL SELECT '0001','COLUMN','shops.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shop_members
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shop_members.role  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='role'),'missing')

  UNION ALL SELECT '0001','COLUMN','shop_members.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='is_active'),'missing')

  UNION ALL SELECT '0001','COLUMN','shop_members.is_active  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='is_active') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — games
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','games.game_code  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='games' AND column_name='game_code'),'missing')

  UNION ALL SELECT '0001','COLUMN','games.game_code  unique_constraint','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='games'
        AND kcu.column_name='game_code' AND tc.constraint_type='UNIQUE')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','games.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='games' AND column_name='is_active'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — game_settings
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','game_settings.game_code  unique_constraint','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='game_settings'
        AND kcu.column_name='game_code' AND tc.constraint_type='UNIQUE')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_settings.cost_percentage  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_settings.cost_percentage  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_settings.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='is_active'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — payment_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','payment_accounts.payment_type  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_type'),'missing')

  UNION ALL SELECT '0001','COLUMN','payment_accounts.status  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status'),'missing')

  UNION ALL SELECT '0001','COLUMN','payment_accounts.image_url  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','payment_accounts.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — game_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','game_accounts.game_code  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_code'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_accounts.game_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_link')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.admin_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_link')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.vendor  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='vendor')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.admin_name  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_name')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.notes  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='notes')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — page_sources
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','page_sources.page_name  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='page_name'),'missing')

  UNION ALL SELECT '0001','COLUMN','page_sources.platform  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='platform'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_reports
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_reports.shift_date  type=date','date',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='shift_date'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_reports.shift_date  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='shift_date'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_reports.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','shift_reports.employee_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='employee_id'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_game_entries
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_game_entries.game_cost_percentage  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='game_cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.game_cost  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='game_cost'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.gross_profit  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='gross_profit'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.true_profit  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='true_profit'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.normal_coin_difference  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='normal_coin_difference'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.real_recharge  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='real_recharge'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_cashouts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_cashouts.amount  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='amount'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.payment_method  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='payment_method'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.employee_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='employee_id'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_payment_entries
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_payment_entries.starting_balance  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_payment_entries' AND column_name='starting_balance'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_payment_entries.difference  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_payment_entries' AND column_name='difference'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — audit_logs
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','audit_logs.details  type=jsonb','jsonb',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='details'),'missing')

  UNION ALL SELECT '0001','COLUMN','audit_logs.record_id  type=uuid','uuid',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='record_id'),'missing')

  UNION ALL SELECT '0001','COLUMN','audit_logs.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · INDEXES
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','INDEX','idx_profiles_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_profiles_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shop_members_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shop_members_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shop_members_user_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shop_members_user_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_payment_accounts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_payment_accounts_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_game_accounts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_game_accounts_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_page_sources_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_page_sources_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_reports_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_reports_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_reports_employee_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_reports_employee_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_game_entries_report_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_game_entries_report_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_cashouts_report_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_cashouts_report_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_cashouts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_cashouts_shop_id') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · FUNCTIONS
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','FUNCTION','public.current_role_name()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='current_role_name') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.current_role_name()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='current_role_name'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.current_shop_id()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='current_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.current_shop_id()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='current_shop_id'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.is_owner()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='is_owner') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.is_owner()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='is_owner'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.is_manager()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='is_manager') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.is_manager()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='is_manager'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.handle_new_user()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='handle_new_user') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.handle_new_user()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='handle_new_user'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · TRIGGER
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created ON auth.users  exists','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created  timing=AFTER','AFTER',
    COALESCE((
      SELECT CASE WHEN (t.tgtype & 4) > 0 THEN 'AFTER' ELSE 'BEFORE_OR_INSTEAD' END
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users'),'missing')

  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created  per_row=YES','YES',
    COALESCE((
      SELECT CASE WHEN (t.tgtype & 1) > 0 THEN 'YES' ELSE 'NO' END
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · RLS ENABLED
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','RLS','public.profiles  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='profiles'),'missing')

  UNION ALL SELECT '0001','RLS','public.shops  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shops'),'missing')

  UNION ALL SELECT '0001','RLS','public.shop_members  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shop_members'),'missing')

  UNION ALL SELECT '0001','RLS','public.games  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='games'),'missing')

  UNION ALL SELECT '0001','RLS','public.game_settings  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_settings'),'missing')

  UNION ALL SELECT '0001','RLS','public.payment_accounts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  UNION ALL SELECT '0001','RLS','public.game_accounts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  UNION ALL SELECT '0001','RLS','public.page_sources  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='page_sources'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_reports  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_reports'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_game_entries  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_game_entries'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_cashouts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_cashouts'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_payment_entries  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_payment_entries'),'missing')

  UNION ALL SELECT '0001','RLS','public.audit_logs  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='audit_logs'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — profiles (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','profiles — profiles_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_update_own  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shops (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shops — shops_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shop_members (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — games (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','games — games_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — game_settings (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shift_payment_entries (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — audit_logs (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','audit_logs — audit_logs_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','audit_logs — audit_logs_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · STORAGE BUCKET
  -- NOTE: 0001 also created storage policies named payment_images_*.
  --   Migration 0007 dropped those and created payment_account_images_*
  --   policies instead. The payment_images_* policies should NOT exist.
  --   The bucket itself persists; verified here.
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','STORAGE_BUCKET','payment-account-images  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM storage.buckets WHERE id='payment-account-images')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','STORAGE_BUCKET','payment-account-images  is_public=true','true',
    COALESCE((SELECT public::text FROM storage.buckets WHERE id='payment-account-images'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · SEED DATA
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','SEED_DATA','games  row_count >= 10','>=10',
    CASE WHEN (SELECT COUNT(*) FROM public.games) >= 10 THEN '>=10' ELSE (SELECT COUNT(*)::text||' rows' FROM public.games) END

  UNION ALL SELECT '0001','SEED_DATA','game_settings  row_count >= 10','>=10',
    CASE WHEN (SELECT COUNT(*) FROM public.game_settings) >= 10 THEN '>=10' ELSE (SELECT COUNT(*)::text||' rows' FROM public.game_settings) END

  UNION ALL SELECT '0001','SEED_DATA','games has JW (Juwa)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM public.games WHERE game_code='JW') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','SEED_DATA','games has GV (Game Vault)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM public.games WHERE game_code='GV') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','SEED_DATA','game_settings GV cost_percentage=12','12',
    COALESCE((SELECT cost_percentage::text FROM public.game_settings WHERE game_code='GV'),'missing')

  UNION ALL SELECT '0001','SEED_DATA','game_settings OS cost_percentage=15','15',
    COALESCE((SELECT cost_percentage::text FROM public.game_settings WHERE game_code='OS'),'missing')

  --------------------------------------------------------------------------
  -- 0002 · profiles.role — DROP NOT NULL + DROP DEFAULT
  --------------------------------------------------------------------------
  UNION ALL SELECT '0002','COLUMN','profiles.role  nullable=YES (NOT NULL dropped)','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role'),'missing')

  UNION ALL SELECT '0002','COLUMN','profiles.role  default=none (DEFAULT dropped)','no_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') IS NULL
    THEN 'no_default' ELSE 'has_default (unexpected)' END

  -- handle_new_user() was replaced in 0002; still must exist and be security definer
  UNION ALL SELECT '0002','FUNCTION','public.handle_new_user()  still_security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='handle_new_user'),'missing')

  UNION ALL SELECT '0002','TRIGGER','on_auth_user_created  still_exists_after_fn_replace','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0003 · Idempotent ADD COLUMN IF NOT EXISTS (all already in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0003','COLUMN','payment_accounts.image_url  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.game_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.admin_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.vendor  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='vendor') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.admin_name  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_name') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.notes  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='notes') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','shift_reports.status  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='status') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0004 · RLS reasserted for payment_accounts and game_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0004','RLS','public.payment_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  UNION ALL SELECT '0004','RLS','public.game_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0005 · payment_accounts.payment_link  + status / game_accounts.status defaults
  --------------------------------------------------------------------------
  UNION ALL SELECT '0005','COLUMN','payment_accounts.payment_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0005','COLUMN','payment_accounts.payment_link  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link'),'missing')

  UNION ALL SELECT '0005','COLUMN','payment_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0005','COLUMN','game_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0006 · payment_link idempotent; page_sources.status default;
  --        shift_game_entries_delete fixed (now allows employee)
  --        All shift_* and page_source policies replaced by 0007/0011.
  --------------------------------------------------------------------------
  UNION ALL SELECT '0006','COLUMN','payment_accounts.payment_link  exists (idempotent check)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0006','COLUMN','payment_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0006','COLUMN','game_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0006','COLUMN','page_sources.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0007 · shift_reports final policies
  --        (0003 first set them; 0006 replaced; 0007 is last replacement)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0007 · shift_game_entries final policies
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0007 · shift_cashouts final policies
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  -- Confirm the 0001 storage policies (payment_images_*) are gone
  UNION ALL SELECT '0007','POLICY_REMOVED','storage.objects — payment_images_select  should_not_exist','missing',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_images_select')
    THEN 'exists (unexpected)' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY_REMOVED','storage.objects — payment_images_insert  should_not_exist','missing',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_images_insert')
    THEN 'exists (unexpected)' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0008 · payment_accounts final policies
  --        + storage.objects payment_account_images_* final policies
  --        (0007 created them; 0008 dropped and re-created the same names)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','COLUMN','payment_accounts.image_url  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','COLUMN','payment_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0008','RLS','public.payment_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0009 · game_accounts.status default 'active'; policies (replaced in 0010)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0009','COLUMN','game_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0009','RLS','public.game_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0010 · game_accounts final policies
  --   (SELECT uses lower(btrim(coalesce(status,'active')))='active' for employee)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0011 · page_sources final policies + column defaults
  --   (SELECT uses lower(btrim(coalesce(status,'active')))='active' for employee)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0011','COLUMN','page_sources.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0011','COLUMN','page_sources.platform  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='platform') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0011','RLS','public.page_sources  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='page_sources'),'missing')

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0012 · Data-only migration — formula: game_cost=0 when profit <= 0
  --------------------------------------------------------------------------
  UNION ALL SELECT '0012','DATA_CHECK','shift_game_entries: no rows with game_cost < 0','0 rows',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 rows' ELSE COUNT(*)::text||' rows' END
       FROM public.shift_game_entries WHERE game_cost < 0),
      '0 rows')

  UNION ALL SELECT '0012','DATA_CHECK','shift_game_entries: no rows where game_cost>0 and profit<=0','0 rows',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 rows' ELSE COUNT(*)::text||' rows' END
       FROM public.shift_game_entries WHERE game_cost > 0 AND gross_profit <= 0),
      '0 rows')

  --------------------------------------------------------------------------
  -- 0013 · Data-only migration — same formula re-applied
  --------------------------------------------------------------------------
  UNION ALL SELECT '0013','DATA_CHECK','shift_game_entries: true_profit = gross_profit - game_cost','0 mismatch',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 mismatch'
                   ELSE COUNT(*)::text||' mismatch rows' END
       FROM public.shift_game_entries
       WHERE ABS(true_profit - (gross_profit - game_cost)) > 0.001),
      '0 mismatch')

  UNION ALL SELECT '0013','DATA_CHECK','shift_game_entries: true_profit <= gross_profit for all rows','0 violations',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 violations'
                   ELSE COUNT(*)::text||' violation rows' END
       FROM public.shift_game_entries
       WHERE true_profit > gross_profit AND gross_profit > 0),
      '0 violations')

)
-- ============================================================================
-- PART 1 OUTPUT — one row per check, sorted by migration then object
-- ============================================================================
SELECT
  migration,
  object_type,
  object_name,
  expected_state,
  actual_state,
  CASE WHEN expected_state = actual_state THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks
ORDER BY migration, object_type, object_name;


-- ============================================================================
-- PART 2 — Per-migration summary  (select this section and click Run)
-- ============================================================================
-- Uses the identical CTE as Part 1 so that check counts and failure counts
-- match exactly between the two sections.
-- ============================================================================

WITH checks AS (

  --------------------------------------------------------------------------
  -- 0001 · EXTENSION
  --------------------------------------------------------------------------
  SELECT '0001'::text      AS migration
       , 'EXTENSION'::text AS object_type
       , 'pgcrypto'::text  AS object_name
       , 'installed'::text AS expected_state
       , COALESCE(
           (SELECT 'installed' FROM pg_extension WHERE extname = 'pgcrypto'),
           'missing')      AS actual_state

  --------------------------------------------------------------------------
  -- 0001 · TABLES
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','TABLE','public.profiles','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shops','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shops') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shop_members','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shop_members') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.games','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='games') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.game_settings','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='game_settings') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.payment_accounts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_accounts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.game_accounts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='game_accounts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.page_sources','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='page_sources') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_reports','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_reports') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_game_entries','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_game_entries') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_cashouts','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_cashouts') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.shift_payment_entries','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_payment_entries') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TABLE','public.audit_logs','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · FK CONSTRAINT
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','FK_CONSTRAINT','profiles.shop_id → shops.id (profiles_shop_id_fkey)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema='public' AND table_name='profiles'
        AND constraint_name='profiles_shop_id_fkey'
        AND constraint_type='FOREIGN KEY')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · CHECK CONSTRAINTS
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','CHECK_CONSTRAINT','profiles.role IN (owner,manager,employee)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='profiles'
        AND cu.column_name='role' AND cc.check_clause LIKE '%owner%')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','CHECK_CONSTRAINT','shop_members.role IN (manager,employee)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='shop_members'
        AND cu.column_name='role' AND cc.check_clause LIKE '%manager%')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','CHECK_CONSTRAINT','payment_accounts.payment_type IN (CashApp,Chime)','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage cu
        ON cu.constraint_schema = cc.constraint_schema
       AND cu.constraint_name   = cc.constraint_name
      WHERE cu.table_schema='public' AND cu.table_name='payment_accounts'
        AND cu.column_name='payment_type' AND cc.check_clause LIKE '%CashApp%')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — profiles
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','profiles.id  type=uuid','uuid',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.email  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.is_active  default=has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0001','COLUMN','profiles.shop_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='shop_id'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.created_at  type=timestamp with time zone','timestamp with time zone',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='created_at'),'missing')

  UNION ALL SELECT '0001','COLUMN','profiles.updated_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='updated_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shops
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shops.name  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='name'),'missing')

  UNION ALL SELECT '0001','COLUMN','shops.status  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='status'),'missing')

  UNION ALL SELECT '0001','COLUMN','shops.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shop_members
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shop_members.role  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='role'),'missing')

  UNION ALL SELECT '0001','COLUMN','shop_members.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='is_active'),'missing')

  UNION ALL SELECT '0001','COLUMN','shop_members.is_active  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_members' AND column_name='is_active') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — games
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','games.game_code  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='games' AND column_name='game_code'),'missing')

  UNION ALL SELECT '0001','COLUMN','games.game_code  unique_constraint','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='games'
        AND kcu.column_name='game_code' AND tc.constraint_type='UNIQUE')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','games.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='games' AND column_name='is_active'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — game_settings
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','game_settings.game_code  unique_constraint','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name='game_settings'
        AND kcu.column_name='game_code' AND tc.constraint_type='UNIQUE')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_settings.cost_percentage  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_settings.cost_percentage  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_settings.is_active  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_settings' AND column_name='is_active'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — payment_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','payment_accounts.payment_type  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_type'),'missing')

  UNION ALL SELECT '0001','COLUMN','payment_accounts.status  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status'),'missing')

  UNION ALL SELECT '0001','COLUMN','payment_accounts.image_url  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','payment_accounts.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — game_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','game_accounts.game_code  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_code'),'missing')

  UNION ALL SELECT '0001','COLUMN','game_accounts.game_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_link')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.admin_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_link')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.vendor  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='vendor')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.admin_name  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_name')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.notes  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='notes')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','game_accounts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — page_sources
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','page_sources.page_name  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='page_name'),'missing')

  UNION ALL SELECT '0001','COLUMN','page_sources.platform  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='platform'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_reports
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_reports.shift_date  type=date','date',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='shift_date'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_reports.shift_date  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='shift_date'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_reports.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','shift_reports.employee_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='employee_id'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_game_entries
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_game_entries.game_cost_percentage  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='game_cost_percentage'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.game_cost  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='game_cost'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.gross_profit  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='gross_profit'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.true_profit  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='true_profit'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.normal_coin_difference  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='normal_coin_difference'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_game_entries.real_recharge  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_game_entries' AND column_name='real_recharge'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_cashouts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_cashouts.amount  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='amount'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.payment_method  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='payment_method'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='status')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','COLUMN','shift_cashouts.employee_id  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_cashouts' AND column_name='employee_id'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — shift_payment_entries
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','shift_payment_entries.starting_balance  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_payment_entries' AND column_name='starting_balance'),'missing')

  UNION ALL SELECT '0001','COLUMN','shift_payment_entries.difference  type=numeric','numeric',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_payment_entries' AND column_name='difference'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · COLUMNS — audit_logs
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','COLUMN','audit_logs.details  type=jsonb','jsonb',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='details'),'missing')

  UNION ALL SELECT '0001','COLUMN','audit_logs.record_id  type=uuid','uuid',
    COALESCE((SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='record_id'),'missing')

  UNION ALL SELECT '0001','COLUMN','audit_logs.created_at  nullable=NO','NO',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='created_at'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · INDEXES
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','INDEX','idx_profiles_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_profiles_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shop_members_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shop_members_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shop_members_user_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shop_members_user_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_payment_accounts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_payment_accounts_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_game_accounts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_game_accounts_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_page_sources_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_page_sources_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_reports_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_reports_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_reports_employee_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_reports_employee_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_game_entries_report_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_game_entries_report_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_cashouts_report_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_cashouts_report_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','INDEX','idx_shift_cashouts_shop_id','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_shift_cashouts_shop_id') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · FUNCTIONS
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','FUNCTION','public.current_role_name()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='current_role_name') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.current_role_name()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='current_role_name'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.current_shop_id()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='current_shop_id') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.current_shop_id()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='current_shop_id'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.is_owner()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='is_owner') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.is_owner()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='is_owner'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.is_manager()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='is_manager') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.is_manager()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='is_manager'),'missing')

  UNION ALL SELECT '0001','FUNCTION','public.handle_new_user()  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='handle_new_user') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','FUNCTION','public.handle_new_user()  security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='handle_new_user'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · TRIGGER
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created ON auth.users  exists','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created  timing=AFTER','AFTER',
    COALESCE((
      SELECT CASE WHEN (t.tgtype & 4) > 0 THEN 'AFTER' ELSE 'BEFORE_OR_INSTEAD' END
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users'),'missing')

  UNION ALL SELECT '0001','TRIGGER','on_auth_user_created  per_row=YES','YES',
    COALESCE((
      SELECT CASE WHEN (t.tgtype & 1) > 0 THEN 'YES' ELSE 'NO' END
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · RLS ENABLED
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','RLS','public.profiles  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='profiles'),'missing')

  UNION ALL SELECT '0001','RLS','public.shops  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shops'),'missing')

  UNION ALL SELECT '0001','RLS','public.shop_members  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shop_members'),'missing')

  UNION ALL SELECT '0001','RLS','public.games  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='games'),'missing')

  UNION ALL SELECT '0001','RLS','public.game_settings  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_settings'),'missing')

  UNION ALL SELECT '0001','RLS','public.payment_accounts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  UNION ALL SELECT '0001','RLS','public.game_accounts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  UNION ALL SELECT '0001','RLS','public.page_sources  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='page_sources'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_reports  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_reports'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_game_entries  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_game_entries'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_cashouts  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_cashouts'),'missing')

  UNION ALL SELECT '0001','RLS','public.shift_payment_entries  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='shift_payment_entries'),'missing')

  UNION ALL SELECT '0001','RLS','public.audit_logs  rls_enabled','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='audit_logs'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — profiles (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','profiles — profiles_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_update_own  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','profiles — profiles_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shops (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shops — shops_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shops — shops_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shop_members (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shop_members — shop_members_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_members' AND policyname='shop_members_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — games (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','games — games_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','games — games_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='games_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — game_settings (last set in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','game_settings — game_settings_owner_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_settings' AND policyname='game_settings_owner_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — shift_payment_entries (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','shift_payment_entries — shift_payment_entries_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_payment_entries' AND policyname='shift_payment_entries_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · POLICIES — audit_logs (last set in 0001; never replaced)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','POLICY','audit_logs — audit_logs_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','POLICY','audit_logs — audit_logs_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0001 · STORAGE BUCKET
  -- NOTE: 0001 also created storage policies named payment_images_*.
  --   Migration 0007 dropped those and created payment_account_images_*
  --   policies instead. The payment_images_* policies should NOT exist.
  --   The bucket itself persists; verified here.
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','STORAGE_BUCKET','payment-account-images  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM storage.buckets WHERE id='payment-account-images')
    THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','STORAGE_BUCKET','payment-account-images  is_public=true','true',
    COALESCE((SELECT public::text FROM storage.buckets WHERE id='payment-account-images'),'missing')

  --------------------------------------------------------------------------
  -- 0001 · SEED DATA
  --------------------------------------------------------------------------
  UNION ALL SELECT '0001','SEED_DATA','games  row_count >= 10','>=10',
    CASE WHEN (SELECT COUNT(*) FROM public.games) >= 10 THEN '>=10' ELSE (SELECT COUNT(*)::text||' rows' FROM public.games) END

  UNION ALL SELECT '0001','SEED_DATA','game_settings  row_count >= 10','>=10',
    CASE WHEN (SELECT COUNT(*) FROM public.game_settings) >= 10 THEN '>=10' ELSE (SELECT COUNT(*)::text||' rows' FROM public.game_settings) END

  UNION ALL SELECT '0001','SEED_DATA','games has JW (Juwa)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM public.games WHERE game_code='JW') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','SEED_DATA','games has GV (Game Vault)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM public.games WHERE game_code='GV') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0001','SEED_DATA','game_settings GV cost_percentage=12','12',
    COALESCE((SELECT cost_percentage::text FROM public.game_settings WHERE game_code='GV'),'missing')

  UNION ALL SELECT '0001','SEED_DATA','game_settings OS cost_percentage=15','15',
    COALESCE((SELECT cost_percentage::text FROM public.game_settings WHERE game_code='OS'),'missing')

  --------------------------------------------------------------------------
  -- 0002 · profiles.role — DROP NOT NULL + DROP DEFAULT
  --------------------------------------------------------------------------
  UNION ALL SELECT '0002','COLUMN','profiles.role  nullable=YES (NOT NULL dropped)','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role'),'missing')

  UNION ALL SELECT '0002','COLUMN','profiles.role  default=none (DEFAULT dropped)','no_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') IS NULL
    THEN 'no_default' ELSE 'has_default (unexpected)' END

  -- handle_new_user() was replaced in 0002; still must exist and be security definer
  UNION ALL SELECT '0002','FUNCTION','public.handle_new_user()  still_security_definer','security_definer',
    COALESCE((SELECT CASE WHEN p.prosecdef THEN 'security_definer' ELSE 'security_invoker' END
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname='handle_new_user'),'missing')

  UNION ALL SELECT '0002','TRIGGER','on_auth_user_created  still_exists_after_fn_replace','exists',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='on_auth_user_created' AND n.nspname='auth' AND c.relname='users')
    THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0003 · Idempotent ADD COLUMN IF NOT EXISTS (all already in 0001)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0003','COLUMN','payment_accounts.image_url  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.game_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='game_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.admin_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.vendor  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='vendor') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.admin_name  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='admin_name') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.notes  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='notes') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','game_accounts.status  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0003','COLUMN','shift_reports.status  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shift_reports' AND column_name='status') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0004 · RLS reasserted for payment_accounts and game_accounts
  --------------------------------------------------------------------------
  UNION ALL SELECT '0004','RLS','public.payment_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  UNION ALL SELECT '0004','RLS','public.game_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0005 · payment_accounts.payment_link  + status / game_accounts.status defaults
  --------------------------------------------------------------------------
  UNION ALL SELECT '0005','COLUMN','payment_accounts.payment_link  exists','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0005','COLUMN','payment_accounts.payment_link  nullable=YES','YES',
    COALESCE((SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link'),'missing')

  UNION ALL SELECT '0005','COLUMN','payment_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0005','COLUMN','game_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0006 · payment_link idempotent; page_sources.status default;
  --        shift_game_entries_delete fixed (now allows employee)
  --        All shift_* and page_source policies replaced by 0007/0011.
  --------------------------------------------------------------------------
  UNION ALL SELECT '0006','COLUMN','payment_accounts.payment_link  exists (idempotent check)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='payment_link') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0006','COLUMN','payment_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0006','COLUMN','game_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0006','COLUMN','page_sources.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  --------------------------------------------------------------------------
  -- 0007 · shift_reports final policies
  --        (0003 first set them; 0006 replaced; 0007 is last replacement)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_reports — shift_reports_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_reports' AND policyname='shift_reports_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0007 · shift_game_entries final policies
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_game_entries — shift_game_entries_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_game_entries' AND policyname='shift_game_entries_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0007 · shift_cashouts final policies
  --------------------------------------------------------------------------
  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY','shift_cashouts — shift_cashouts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shift_cashouts' AND policyname='shift_cashouts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  -- Confirm the 0001 storage policies (payment_images_*) are gone
  UNION ALL SELECT '0007','POLICY_REMOVED','storage.objects — payment_images_select  should_not_exist','missing',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_images_select')
    THEN 'exists (unexpected)' ELSE 'missing' END

  UNION ALL SELECT '0007','POLICY_REMOVED','storage.objects — payment_images_insert  should_not_exist','missing',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_images_insert')
    THEN 'exists (unexpected)' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0008 · payment_accounts final policies
  --        + storage.objects payment_account_images_* final policies
  --        (0007 created them; 0008 dropped and re-created the same names)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','payment_accounts — payment_accounts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','POLICY','storage.objects — payment_account_images_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='payment_account_images_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','COLUMN','payment_accounts.image_url  exists (idempotent)','exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='image_url') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0008','COLUMN','payment_accounts.status  has_default (idempotent)','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0008','RLS','public.payment_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='payment_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0009 · game_accounts.status default 'active'; policies (replaced in 0010)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0009','COLUMN','game_accounts.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_accounts' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0009','RLS','public.game_accounts  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='game_accounts'),'missing')

  --------------------------------------------------------------------------
  -- 0010 · game_accounts final policies
  --   (SELECT uses lower(btrim(coalesce(status,'active')))='active' for employee)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0010','POLICY','game_accounts — game_accounts_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_accounts' AND policyname='game_accounts_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0011 · page_sources final policies + column defaults
  --   (SELECT uses lower(btrim(coalesce(status,'active')))='active' for employee)
  --------------------------------------------------------------------------
  UNION ALL SELECT '0011','COLUMN','page_sources.status  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='status') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0011','COLUMN','page_sources.platform  has_default','has_default',
    CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='page_sources' AND column_name='platform') IS NOT NULL
    THEN 'has_default' ELSE 'no_default' END

  UNION ALL SELECT '0011','RLS','public.page_sources  rls_enabled (reasserted)','enabled',
    COALESCE((SELECT CASE WHEN relrowsecurity THEN 'enabled' ELSE 'disabled' END
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='page_sources'),'missing')

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_select  cmd=SELECT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_select' AND cmd='SELECT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_insert  cmd=INSERT','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_insert' AND cmd='INSERT') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_update  cmd=UPDATE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_update' AND cmd='UPDATE') THEN 'exists' ELSE 'missing' END

  UNION ALL SELECT '0011','POLICY','page_sources — page_sources_delete  cmd=DELETE','exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='page_sources' AND policyname='page_sources_delete' AND cmd='DELETE') THEN 'exists' ELSE 'missing' END

  --------------------------------------------------------------------------
  -- 0012 · Data-only migration — formula: game_cost=0 when profit <= 0
  --------------------------------------------------------------------------
  UNION ALL SELECT '0012','DATA_CHECK','shift_game_entries: no rows with game_cost < 0','0 rows',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 rows' ELSE COUNT(*)::text||' rows' END
       FROM public.shift_game_entries WHERE game_cost < 0),
      '0 rows')

  UNION ALL SELECT '0012','DATA_CHECK','shift_game_entries: no rows where game_cost>0 and profit<=0','0 rows',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 rows' ELSE COUNT(*)::text||' rows' END
       FROM public.shift_game_entries WHERE game_cost > 0 AND gross_profit <= 0),
      '0 rows')

  --------------------------------------------------------------------------
  -- 0013 · Data-only migration — same formula re-applied
  --------------------------------------------------------------------------
  UNION ALL SELECT '0013','DATA_CHECK','shift_game_entries: true_profit = gross_profit - game_cost','0 mismatch',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 mismatch'
                   ELSE COUNT(*)::text||' mismatch rows' END
       FROM public.shift_game_entries
       WHERE ABS(true_profit - (gross_profit - game_cost)) > 0.001),
      '0 mismatch')

  UNION ALL SELECT '0013','DATA_CHECK','shift_game_entries: true_profit <= gross_profit for all rows','0 violations',
    COALESCE(
      (SELECT CASE WHEN COUNT(*)=0 THEN '0 violations'
                   ELSE COUNT(*)::text||' violation rows' END
       FROM public.shift_game_entries
       WHERE true_profit > gross_profit AND gross_profit > 0),
      '0 violations')

)
, results AS (
  SELECT *,
    CASE WHEN expected_state = actual_state THEN 'PASS' ELSE 'FAIL' END AS result
  FROM checks
)
SELECT
  migration,
  COUNT(*)                                          AS total_checks,
  COUNT(*) FILTER (WHERE result = 'PASS')           AS passed,
  COUNT(*) FILTER (WHERE result = 'FAIL')           AS failed,
  CASE
    WHEN COUNT(*) FILTER (WHERE result = 'FAIL') = 0
    THEN 'ALL PASS'
    ELSE 'HAS FAILURES — run Part 1 for details'
  END                                               AS verdict
FROM results
GROUP BY migration
ORDER BY migration;
