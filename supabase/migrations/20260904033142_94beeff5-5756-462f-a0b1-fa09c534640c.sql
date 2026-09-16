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