-- LOT C2 -- 04 ROLLBACK (targeted). Gives members back the right to INSERT and UPDATE the columns that 01_preflight showed as writable.
-- DOES THIS REINTRODUCE A WEAKNESS? Yes: a member could again write their own project credits, invitation allowance and inviter.
-- Restore only what was writable before: the list below is the three columns lot0b showed as writable. Add 'available_invites' to it ONLY if
-- the writable_today of your 01_preflight showed it as writable; granting it when it was denied would widen what members could do before lot C2.

BEGIN;

DO $rollback$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['project_credits', 'invite_code_used', 'invited_by'] LOOP
    EXECUTE format('GRANT UPDATE (%I) ON TABLE public.profiles TO authenticated', c);
    EXECUTE format('GRANT INSERT (%I) ON TABLE public.profiles TO authenticated', c);
  END LOOP;
END
$rollback$;

COMMIT;

SELECT bool_and(has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE')) AS restored
FROM unnest(ARRAY['project_credits', 'invite_code_used', 'invited_by']) AS c;
