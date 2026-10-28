-- Read-only check, run AFTER supabase/migrations/20261028120000_atomic_ai_quota_consume.sql is applied.
-- Expect: 3 rows, atomic_cap_check = true on every row, and the three grant columns false / false / true.
-- Writes nothing.
SELECT
  p.proname,
  p.prosrc ILIKE '%WHERE % < _daily_cap%' AS atomic_cap_check,
  p.prosrc NOT ILIKE '%>= _daily_cap%'     AS no_read_then_check,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('consume_copilot_message', 'consume_studio_ai_generation', 'consume_ai_feature_call')
ORDER BY p.proname;
