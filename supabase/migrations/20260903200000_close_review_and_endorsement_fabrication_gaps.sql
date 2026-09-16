-- Two critical gaps flagged by the security scanner, both allowing anyone
-- to fabricate testimonials on someone else's profile.
--
-- 1) reviews had a *third*, unconditional INSERT policy alongside the two
--    legitimate token-gated ones: "Users can create reviews" only checked
--    auth.uid() = reviewer_id -- nothing tying the row to profile_id at
--    all. Since Postgres OR's permissive policies together, this alone let
--    any signed-in user post a review (any rating, any text) on ANY
--    profile, completely bypassing the review_requests/token system.
--    Confirmed dead: no insert site in the app sets reviewer_id (only
--    src/pages/SubmitReview.tsx inserts, and it always goes through
--    submission_token) -- safe to drop outright, nothing legitimate uses it.
--
-- 2) skill_endorsements had it worse: both of its INSERT policies were
--    `WITH CHECK (true)` -- one for anon, one for authenticated -- so
--    literally anyone, signed in or not, could insert an endorsement row
--    for any profile_id with any skill/testimonial, again bypassing the
--    skill_endorsement_requests/token system the app's own submission flow
--    (src/pages/EndorseSkill.tsx) is built around.
--
--    A prior migration (20260327223242) already tried to fix this: it
--    added a properly-scoped "Endorsements require valid pending request"
--    policy, but its own DROP POLICY IF EXISTS statements named policies
--    that never existed ("Anyone can create endorsements", "Anon can
--    create endorsements", etc.) -- silent no-ops. The two actually-named
--    `WITH CHECK (true)` policies ("Allow authenticated to insert skill
--    endorsements", "Anonymous users can insert skill endorsements") were
--    never touched and stayed active. Since Postgres OR's permissive
--    policies together, the new stricter policy changed nothing -- the
--    fully-open ones still passed everything. That's why the scanner
--    still flags this as critical today.
--
-- Fix: drop the unconditional policies (this time by their real names),
-- and replace the whole set -- including the ineffective 2026-03-27 one,
-- which only matched on profile_id + skill_name and so still let anyone
-- endorse a profile's open request without ever holding its token -- with
-- policies that require the exact request_id the app's own submission
-- flow always sets. Same tightening for reviews: the existing token-gated
-- policies checked "some pending request exists for this profile", not
-- "the token I hold matches one", so a profile with any open invite let
-- anyone through regardless of which token they had.

-- ── reviews ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;

DROP POLICY IF EXISTS "Anyone can submit reviews via valid token" ON public.reviews;
CREATE POLICY "Anyone can submit reviews via valid token"
ON public.reviews
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.review_requests
    WHERE review_requests.profile_id = reviews.profile_id
      AND review_requests.share_token = reviews.submission_token
      AND review_requests.status = 'pending'
      AND review_requests.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Authenticated users can submit reviews via token" ON public.reviews;
CREATE POLICY "Authenticated users can submit reviews via token"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.review_requests
    WHERE review_requests.profile_id = reviews.profile_id
      AND review_requests.share_token = reviews.submission_token
      AND review_requests.status = 'pending'
      AND review_requests.expires_at > now()
  )
);

-- ── skill_endorsements ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated to insert skill endorsements" ON public.skill_endorsements;
DROP POLICY IF EXISTS "Anonymous users can insert skill endorsements" ON public.skill_endorsements;
DROP POLICY IF EXISTS "Endorsements require valid pending request" ON public.skill_endorsements;
DROP POLICY IF EXISTS "Anonymous can submit endorsements via valid request" ON public.skill_endorsements;
DROP POLICY IF EXISTS "Authenticated can submit endorsements via valid request" ON public.skill_endorsements;

CREATE POLICY "Anonymous can submit endorsements via valid request"
ON public.skill_endorsements
FOR INSERT
TO anon
WITH CHECK (
  request_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.skill_endorsement_requests r
    WHERE r.id = skill_endorsements.request_id
      AND r.profile_id = skill_endorsements.profile_id
      AND r.status = 'pending'
      AND r.expires_at > now()
  )
);

CREATE POLICY "Authenticated can submit endorsements via valid request"
ON public.skill_endorsements
FOR INSERT
TO authenticated
WITH CHECK (
  request_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.skill_endorsement_requests r
    WHERE r.id = skill_endorsements.request_id
      AND r.profile_id = skill_endorsements.profile_id
      AND r.status = 'pending'
      AND r.expires_at > now()
  )
);
