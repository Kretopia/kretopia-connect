-- ============================================================================
-- Scouted-event claim by token (audit 2026-10-09). ADDITIVE ONLY: apply this
-- BEFORE publishing the frontend that calls it; the two policy drops live in
-- 20261009090400 and must be applied AFTER the frontend is published.
--
-- PROBLEM (verified on production)
--   creative_jams UPDATE policy "Authenticated users can claim unclaimed
--   events" is USING (claim_status = 'unclaimed') WITH CHECK (created_by =
--   auth.uid() AND claim_status = 'claimed'): it never checks the claim token,
--   so ANY signed-in user can make themselves host of ANY unclaimed event.
--   And "Anyone can read unclaimed scouted events" lets an anonymous visitor
--   list every unclaimed event together with its claim_token.
--
-- FIX
--   Two SECURITY DEFINER functions that take the token as the only key:
--     get_scouted_event_by_token(token)  -> the event card, by token
--     claim_scouted_event(token)         -> atomic claim for the caller
--   plus a cryptographically random generate_claim_token() (it was
--   md5(random()) truncated to 64 bits).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_scouted_event_by_token(p_token text)
RETURNS TABLE(
  id uuid, title text, description text, category text, venue_name text, venue_address text,
  country text, start_time timestamptz, end_time timestamptz, cover_image_url text,
  claim_status text, scouted_by uuid, created_by uuid, source_platform text, source_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT j.id, j.title, j.description, j.category, j.venue_name, j.venue_address,
         j.country, j.start_time, j.end_time, j.cover_image_url,
         j.claim_status, j.scouted_by, j.created_by, j.source_platform, j.source_url
  FROM public.creative_jams j
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 12
    AND j.claim_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.claim_scouted_event(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this event' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_token');
  END IF;

  UPDATE public.creative_jams
     SET created_by = v_uid, claim_status = 'claimed'
   WHERE claim_token = p_token
     AND claim_status = 'unclaimed'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_available');
  END IF;
  RETURN jsonb_build_object('claimed', true, 'event_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_scouted_event_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scouted_event_by_token(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_scouted_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_scouted_event(text) TO authenticated, service_role;

-- Same output shape ('claim_' + hex), cryptographic randomness.
CREATE OR REPLACE FUNCTION public.generate_claim_token()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'claim_' || encode(extensions.gen_random_bytes(16), 'hex');
END;
$$;

NOTIFY pgrst, 'reload schema';
