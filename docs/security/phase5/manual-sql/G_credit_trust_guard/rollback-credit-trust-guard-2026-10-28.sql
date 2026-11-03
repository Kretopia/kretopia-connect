-- ROLLBACK: credit trust-field guard. Restores guard_credit_verification_escalation() exactly as the repo defined it
-- before 20261028130000 (20260812071205_c57b2c1c-1974-49bb-9075-ffff9ffb5e30.sql). Paste into the SQL editor of the
-- production database and run once. The trigger is untouched. Only use it if credit writes misbehave after the apply.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_credit_verification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IN ('verified', 'auto_discovered')
     AND (TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
     AND auth.role() <> 'service_role'
     AND current_setting('app.credit_verification_authorized', true) IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'verification_status cannot be escalated to % directly — use an authorized verification RPC', NEW.verification_status;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- Check (read-only): expect has_peer_guard = false after a rollback.
SELECT p.prosrc ILIKE '%''verified'', ''auto_discovered'', ''peer''%' AS has_peer_guard
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'guard_credit_verification_escalation';
