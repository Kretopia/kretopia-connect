-- Critical flagged by the deep security scan: the 'opportunities' table
-- stores guest_email (and other guest contact fields) for guest-posted
-- gigs, and the 'Public can view active opportunities' policy allows anyone
-- (including unauthenticated users) to SELECT full rows for status='active'
-- opportunities with no column-level restriction. This lets anonymous
-- visitors harvest guest posters' email addresses directly from public gig
-- listings via the REST API, regardless of what the React app's own queries
-- ask for.
--
-- Confirmed via grep: guest_email, guest_company_name, guest_logo_url,
-- guest_profile_id, and verification_token are never read by any client
-- code today (the guest-posting UI that would have used them was never
-- wired up) -- so nothing legitimate needs client-side access to them.
-- verification_token in particular follows the exact same "leaks the secret
-- that grants a privileged action" pattern already fixed this session for
-- verify-brand-credit, so it's included even though the scanner only named
-- guest_email by title.
--
-- Same root cause and fix pattern as every other privilege-drift finding
-- this session: table-level REVOKE, then re-GRANT every column except the
-- guest-contact/verification ones. All 9 client call sites that previously
-- used select('*') on this table are updated in the same change to request
-- an explicit safe column list instead -- a bare '*' fails with "permission
-- denied for column" the moment any column loses its blanket grant,
-- regardless of whether the caller is the row's owner.

REVOKE SELECT ON public.opportunities FROM anon, authenticated;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities'
      AND column_name NOT IN ('guest_email', 'guest_company_name', 'guest_logo_url', 'guest_profile_id', 'verification_token')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.opportunities TO anon, authenticated', _col);
  END LOOP;
END $$;
