-- Warning flagged by the security scanner: "Function Search Path Mutable."
--
-- A prior migration (20260409152830) already tried to fix this, but had
-- two real gaps that likely left it incomplete:
--   1. `LIMIT 10` -- if more than 10 functions lacked a pinned search_path
--      at the time it ran, only the first 10 (in whatever arbitrary order
--      pg_proc returned them) actually got fixed.
--   2. `AND NOT p.prosecdef` -- it explicitly SKIPPED every SECURITY
--      DEFINER function. Those are the more dangerous category to leave
--      mutable: a SECURITY DEFINER function runs with its owner's
--      elevated privileges, so a mutable search_path on one is the
--      classic privilege-escalation vector (a caller-controlled schema
--      earlier in the resolution path can shadow a table/function the
--      definer function expects to resolve to its trusted, intended one).
--
-- This is the same fix, corrected: no row limit, and covers every
-- function regardless of SECURITY DEFINER status. Idempotent -- functions
-- that already have search_path pinned are simply skipped (no-op), so
-- this is safe to re-run.
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
      ))
      AND p.proname NOT LIKE 'pg_%'
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', func_record.proname, func_record.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter function %(%): %', func_record.proname, func_record.args, SQLERRM;
    END;
  END LOOP;
END;
$$;
