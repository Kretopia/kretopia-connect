-- Warning flagged by the deep security scan: "Users can fake verification/
-- endorsement status on their own credits, awards, and press."
--
-- "The UPDATE policies on 'credits', 'awards', and 'press_links' ('Users
-- can update own credits/awards/press links') only check ownership without
-- restricting columns via WITH CHECK. This lets a user set
-- verification_status (e.g. to 'verified'), ai_confidence, and
-- endorsement_count directly, undermining the credibility features these
-- fields are meant to protect."
--
-- Same root cause as every other privilege-drift finding this session
-- (milestones, profiles, invoices): Postgres RLS's USING/WITH CHECK can't
-- restrict individual columns on its own, and this project's tables have
-- always carried a table-level UPDATE grant from Supabase's project
-- defaults underneath the RLS layer. Fix with the same pattern already
-- applied to profiles/invoices: table-level REVOKE, then re-GRANT every
-- column except the trust-signaling ones, which stay writable only via
-- their existing SECURITY DEFINER paths (increment_endorsement_count,
-- verify-credit, verify-brand-credit).
--
-- Confirmed via grep: no client code in src/ ever writes verification_status,
-- ai_confidence, endorsement_count, verified_by_name, or verification_url on
-- any of these three tables.

REVOKE UPDATE ON public.credits FROM authenticated, anon;
DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credits'
      AND column_name NOT IN ('verification_status', 'ai_confidence', 'endorsement_count', 'verified_by_name', 'verification_url')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.credits TO authenticated', _col);
  END LOOP;
END $$;

REVOKE UPDATE ON public.awards FROM authenticated, anon;
DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'awards'
      AND column_name NOT IN ('verification_status', 'verification_url')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.awards TO authenticated', _col);
  END LOOP;
END $$;

REVOKE UPDATE ON public.press_links FROM authenticated, anon;
DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'press_links'
      AND column_name NOT IN ('verification_status')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.press_links TO authenticated', _col);
  END LOOP;
END $$;
