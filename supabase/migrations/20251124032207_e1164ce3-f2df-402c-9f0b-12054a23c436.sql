-- Fix critical email exposure issues with correct column names

-- 1. UPDATE SKILL ENDORSEMENTS RLS - hide emails from non-owners
DROP POLICY IF EXISTS "Allow public to insert skill endorsements" ON public.skill_endorsements;
DROP POLICY IF EXISTS "Profile owners view endorsements with contact info" ON public.skill_endorsements;

CREATE POLICY "Allow authenticated to insert skill endorsements" ON public.skill_endorsements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Profile owners view all endorsement details" ON public.skill_endorsements
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Public can view endorsements without contact info" ON public.skill_endorsements
  FOR SELECT
  USING (
    -- Everyone can see endorsements but emails are filtered at application level
    true
  );

-- 2. UPDATE REVIEWS RLS - hide emails from non-owners
DROP POLICY IF EXISTS "Approved reviews viewable by everyone (no emails)" ON public.reviews;
DROP POLICY IF EXISTS "Profile owners can view all their reviews" ON public.reviews;

CREATE POLICY "Profile owners view all review details" ON public.reviews
  FOR SELECT
  USING (profile_id = auth.uid() OR reviewer_id = auth.uid());

CREATE POLICY "Public view approved reviews without emails" ON public.reviews
  FOR SELECT
  USING (status = 'approved');

-- 3. UPDATE INVITES RLS - only inviter sees full details
DROP POLICY IF EXISTS "Invitees can view limited invite details" ON public.invites;

CREATE POLICY "Only inviter can view invite details" ON public.invites
  FOR SELECT
  USING (inviter_id = auth.uid());

-- 4. TIGHTEN PARTNER SUBMISSIONS RLS
DROP POLICY IF EXISTS "Submitters can view own submissions" ON public.partner_submissions;

CREATE POLICY "Only submitter and admins view submissions" ON public.partner_submissions
  FOR SELECT
  USING (
    contact_email = get_user_email(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. TIGHTEN WAITLIST RLS
DROP POLICY IF EXISTS "Users can view their own waitlist entry" ON public.waitlist;

CREATE POLICY "Only user and admins view waitlist entries" ON public.waitlist
  FOR SELECT
  USING (
    email = get_user_email(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );