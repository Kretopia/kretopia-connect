
-- SECURITY FIX 2: Notifications - restrict INSERT
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Users can only create own notifications or admin"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

-- SECURITY FIX 3: Review requests - fix token check
DROP POLICY IF EXISTS "Token-based review access" ON review_requests;
CREATE POLICY "Owner can view own review requests"
ON review_requests FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- SECURITY FIX 4: Skill endorsement requests - fix token check
DROP POLICY IF EXISTS "Token or owner access to endorsement requests" ON skill_endorsement_requests;
DROP POLICY IF EXISTS "Anonymous can view endorsement requests via token" ON skill_endorsement_requests;
CREATE POLICY "Owner can view own endorsement requests"
ON skill_endorsement_requests FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- SECURITY FIX 5: Skill endorsements - restrict INSERT
DROP POLICY IF EXISTS "Anyone can create endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Anon can create endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Authenticated can create endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Anyone can create endorsements via token" ON skill_endorsements;

CREATE POLICY "Endorsements require valid pending request"
ON skill_endorsements FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM skill_endorsement_requests ser
    WHERE ser.profile_id = skill_endorsements.profile_id
      AND ser.skill_name = skill_endorsements.skill_name
      AND ser.status = 'pending'
      AND ser.expires_at > now()
  )
);

-- SECURITY FIX 6: Talent referrals - restrict INSERT
DROP POLICY IF EXISTS "System can insert referrals" ON talent_referrals;
CREATE POLICY "Users can insert own referrals"
ON talent_referrals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = manager_id);

-- SECURITY FIX 7: Referral commissions - restrict INSERT
DROP POLICY IF EXISTS "System can insert commissions" ON referral_commissions;
CREATE POLICY "Only admins can insert commissions"
ON referral_commissions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SECURITY FIX 8: Profile claim requests - require auth
DROP POLICY IF EXISTS "Anyone can create claim requests" ON profile_claim_requests;
CREATE POLICY "Authenticated users create own claim requests"
ON profile_claim_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = claimant_user_id);

-- SECURITY FIX 9: Partner signups - add policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_signups' AND policyname = 'Admins can view partner signups'
  ) THEN
    CREATE POLICY "Admins can view partner signups"
    ON partner_signups FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_signups' AND policyname = 'Anyone can submit partner signup'
  ) THEN
    CREATE POLICY "Anyone can submit partner signup"
    ON partner_signups FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);
  END IF;
END $$;
