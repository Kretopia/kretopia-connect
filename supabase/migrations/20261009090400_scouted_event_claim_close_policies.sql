-- ============================================================================
-- APPLY ONLY AFTER 20261009090300 IS APPLIED *AND* THE FRONTEND THAT USES
-- get_scouted_event_by_token / claim_scouted_event IS PUBLISHED
-- (www.kretopia.com/version.json changed; /claim-event/<token> loads).
-- Applying it earlier breaks the existing claim page.
--
-- Drops the policies that made claiming possible without the token and that
-- exposed claim_token to anonymous visitors, and the unused public read of
-- partner_invite_links (partner codes + contact fields; no code reads it,
-- use_partner_code is a definer function and does not need the policy).
--
-- Product check before applying: unclaimed events stop being visible to
-- anyone but the scout and token holders. (The public listing only ever
-- showed claimed, public events.)
--
-- ROLLBACK: security/rollback-2026-10-09.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.creative_jams') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can claim unclaimed events" ON public.creative_jams;
    DROP POLICY IF EXISTS "Anyone can read unclaimed scouted events" ON public.creative_jams;
  END IF;
  IF to_regclass('public.partner_invite_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public read of active partner links" ON public.partner_invite_links;
  END IF;
END $$;
