-- Read-only check, run AFTER supabase/migrations/20261028130000_guard_credit_trust_fields_on_insert.sql is applied.
-- Expect one row, all three booleans true. Writes nothing.
SELECT
  p.prosrc ILIKE '%''verified'', ''auto_discovered'', ''peer''%'  AS guards_peer,
  p.prosrc ILIKE '%endorsement_count%verified_by_name%'            AS guards_insert_trust_fields,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.credits'::regclass
      AND t.tgname = 'guard_credit_verification_escalation'
      AND NOT t.tgisinternal
  )                                                                  AS trigger_still_attached
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'guard_credit_verification_escalation';
