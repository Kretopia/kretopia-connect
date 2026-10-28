-- A credit's trust signals are written by the server, never by the credit's owner.
--
-- guard_credit_verification_escalation() (20260812071205) refuses an INSERT or an UPDATE that sets
-- verification_status to 'verified' or 'auto_discovered' unless the caller is service_role or inside an RPC that set
-- app.credit_verification_authorized. Two other trust signals were left open on INSERT:
--   * verification_status = 'peer': the co-signed state. statusEngine and creativeRecord count it as a trust rung, and
--     the only legitimate writer is submit_credit_endorsement_by_token (it sets the authorization flag first).
--   * endorsement_count > 0 and verified_by_name: "N endorsements" and "verified by <name>" are rendered next to the
--     credit. Column UPDATE is already revoked from authenticated/anon (20260904210000), but a plain INSERT sets them.
-- So a signed-in user could insert credits already marked 'peer', with an endorsement count and a verifier name, and
-- raise their Creative Status without a single co-sign. No client code sends these fields on insert.
--
-- Now the same rule covers 'peer', and an INSERT by an unauthorized caller must carry no endorsement count and no
-- verifier name. Deliberately NOT touched: verification_url and ai_confidence (connect-platform, the fetch-*-credits
-- importers and enrich-creator-profile write them for credits that stay 'pending' / 'unverified').
--
-- Unchanged: who is authorized (service_role, or an RPC that set the flag), the downgrade freedom (a user may set
-- their own credit to 'unverified' / 'rejected'), the trigger itself (CREATE OR REPLACE keeps it).
--
-- No schema change, no data change. Not applied to production by the commit that adds this file.
-- Rollback: re-run the function from 20260812071205_c57b2c1c-1974-49bb-9075-ffff9ffb5e30.sql (lines 121-139).

CREATE OR REPLACE FUNCTION public.guard_credit_verification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean :=
    auth.role() = 'service_role'
    OR current_setting('app.credit_verification_authorized', true) IS NOT DISTINCT FROM 'true';
BEGIN
  IF NOT v_authorized THEN
    IF NEW.verification_status IN ('verified', 'auto_discovered', 'peer')
       AND (TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
    THEN
      RAISE EXCEPTION 'verification_status cannot be escalated to % directly — use an authorized verification RPC', NEW.verification_status;
    END IF;

    IF TG_OP = 'INSERT'
       AND (COALESCE(NEW.endorsement_count, 0) <> 0 OR NEW.verified_by_name IS NOT NULL)
    THEN
      RAISE EXCEPTION 'endorsement_count and verified_by_name are set by verification, not on insert';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
