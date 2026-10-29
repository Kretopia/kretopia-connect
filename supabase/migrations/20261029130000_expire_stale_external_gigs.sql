-- A gig found outside Kretopia stops being public 30 days after the date its source published it.
--
-- Decision (2026-10-29): "expire each listing 30 days after its publication date at the source". Feed postings carry no deadline, so without
-- a rule they stayed public until a curator expired them by hand, and the list would only have aged. The rule lives in the one view every
-- public reader goes through (the listing page, the Sourced lane, the Match deck, the sitemap), so it applies everywhere at once and
-- needs no schedule.
--
--   * Only gigs: an event has its own dates (ends_at) and a talent listing has none, and an event can be published long before it takes place.
--   * Not a claimed listing: its owner manages it, deadline included.
--   * The date is the one the source states (source_published_at); when the source stated none, the day Kretopia first saw it
--     (created_at), so nothing stays public forever for lack of a date. Exactly 30 days old is already expired.
--   * Nothing is deleted or re-labelled: status stays 'published'. A curator who still wants such a listing public can claim it,
--     or re-import it, which starts a new date. The existing deadline rule (deadline_at in the past hides it) is unchanged.
--
-- The view's access is re-asserted here (clients read, only the service role writes, security_barrier on), so replacing it can never reopen
-- what 20261029120000 closed. Idempotent. No data is changed. Not applied to production by the commit that adds this file.

CREATE OR REPLACE VIEW public.public_external_listings WITH (security_barrier = true) AS
  SELECT id, kind, status, title, original_publisher, location, remote_scope, source_published_at, deadline_at, deadline_tz,
         budget, apply_url, excerpt, description_full, starts_at, ends_at, roles, verification_status, last_checked_at,
         source_provider, source_url, applications_enabled, (status = 'claimed') AS claimed
  FROM public.external_listings
  WHERE status IN ('published', 'claimed') AND visibility = 'public' AND NOT flagged_instructions
    AND (deadline_at IS NULL OR deadline_at > now())
    AND (kind <> 'gig' OR status = 'claimed' OR coalesce(source_published_at, created_at) > now() - interval '30 days');

REVOKE ALL ON public.public_external_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_external_listings TO anon, authenticated;
GRANT ALL ON public.public_external_listings TO service_role;
