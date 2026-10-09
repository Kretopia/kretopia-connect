-- ============================================================================
-- Scouted-gig claim by token (audit F28, approved 2026-10-09).
--
-- APPLY ONLY AFTER the frontend of this change is published
-- (www.kretopia.com/version.json changed). The frontend no longer reads
-- opportunities.claim_token; the old one does, and this migration revokes it:
-- applying earlier breaks every gig page for the old frontend.
--
-- PROBLEM (verified on production, 2026-10-09)
--   1. opportunities has one UPDATE policy, auth.uid() = created_by. The person
--      claiming a gig is not its creator (the scout is), so the claim UPDATE
--      matched 0 rows: 0 of 22 gigs were ever claimed.
--   2. claim_token is in the public column list and the public SELECT policy
--      covers active rows, so anonymous visitors could read the token of every
--      unclaimed gig. Harmless only because claiming could not succeed.
--
-- FIX (one transaction, so there is no moment where claiming works while the
-- tokens are still public)
--   a. get_scouted_opportunity_by_token(token): the claim page's card, by token.
--   b. claim_scouted_opportunity(token): atomic claim for the signed-in caller.
--   c. get_or_create_opportunity_claim_token(id): the scout / owner gets their
--      own share link; tokens made here use the crypto generator from 0300.
--   d. Every token that was ever publicly readable is cleared (unclaimed gigs
--      only; claimed gigs no longer need one). Links already shared never
--      worked; a scout re-shares from the gig page and gets a fresh token.
--   e. claim_token leaves the SELECT grant of anon and authenticated (same
--      table-level REVOKE + per-column GRANT as
--      20260905110000_lock_opportunities_guest_contact_columns.sql).
--
-- ROLLBACK: security/rollback-2026-10-09.sql (section "gig claim by token").
-- Cleared tokens are not recoverable by design; they were public.
-- ============================================================================

-- The draft of these functions (security/proposals/…) may already be installed
-- with a different return shape, which CREATE OR REPLACE cannot change: drop
-- the old shapes first. get_my_opportunity_claim_token was the draft's read-only
-- link getter, replaced by get_or_create_opportunity_claim_token below.
DROP FUNCTION IF EXISTS public.get_scouted_opportunity_by_token(text);
DROP FUNCTION IF EXISTS public.get_my_opportunity_claim_token(uuid);

CREATE OR REPLACE FUNCTION public.get_scouted_opportunity_by_token(p_token text)
RETURNS TABLE(
  id uuid, title text, type text, description text, compensation text, location text,
  tags text[], claim_status text, scouted_by uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.title, o.type, o.description, o.compensation, o.location,
         o.tags, o.claim_status, o.scouted_by
  FROM public.opportunities o
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 12
    AND o.claim_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_opportunity(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this gig' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_token');
  END IF;

  UPDATE public.opportunities
     SET created_by = v_uid, claim_status = 'claimed'
   WHERE claim_token = p_token
     AND coalesce(claim_status, 'unclaimed') = 'unclaimed'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_available');
  END IF;
  RETURN jsonb_build_object('claimed', true, 'opportunity_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_opportunity_claim_token(p_opportunity_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;

  SELECT o.claim_token, o.claim_status INTO v_token, v_status
  FROM public.opportunities o
  WHERE o.id = p_opportunity_id
    AND (o.scouted_by = v_uid OR o.created_by = v_uid);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not your gig' USING ERRCODE = '42501';
  END IF;

  IF coalesce(v_status, 'unclaimed') = 'claimed' THEN
    RETURN NULL; -- nothing left to claim
  END IF;

  IF v_token IS NULL OR length(v_token) < 12 THEN
    v_token := public.generate_claim_token();
    UPDATE public.opportunities
       SET claim_token = v_token, claim_status = coalesce(claim_status, 'unclaimed')
     WHERE id = p_opportunity_id;
  END IF;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_scouted_opportunity_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scouted_opportunity_by_token(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_scouted_opportunity(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_scouted_opportunity(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_or_create_opportunity_claim_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_opportunity_claim_token(uuid) TO authenticated, service_role;

-- d. Tokens that were readable by anyone stop being valid.
UPDATE public.opportunities
   SET claim_token = NULL
 WHERE claim_token IS NOT NULL;

-- e. claim_token is no longer readable by clients.
REVOKE SELECT ON public.opportunities FROM anon, authenticated;
DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities'
      AND column_name NOT IN ('guest_email', 'guest_company_name', 'guest_logo_url', 'guest_profile_id',
                              'verification_token', 'claim_token')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.opportunities TO anon, authenticated', _col);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
