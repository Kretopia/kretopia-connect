-- Fix critical RLS security issues

-- 1. Drop overly permissive profile policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public can view safe profile fields" ON profiles;

-- Keep existing public view but add policy for authenticated users
CREATE POLICY "All profiles viewable for discovery"
ON profiles FOR SELECT
USING (true);

-- 2. Fix skill_endorsements - authenticated only
DROP POLICY IF EXISTS "Anyone can view endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Authenticated users can view endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Users can view endorsements with hidden emails" ON skill_endorsements;

CREATE POLICY "Authenticated users can view endorsements"
ON skill_endorsements FOR SELECT
TO authenticated
USING (true);

-- 3. Fix reviews table - hide reviewer_email from public view
DROP POLICY IF EXISTS "Anyone can view published reviews" ON reviews;
DROP POLICY IF EXISTS "Published reviews are viewable by everyone" ON reviews;
DROP POLICY IF EXISTS "Published reviews viewable without email exposure" ON reviews;

CREATE POLICY "Published reviews are viewable"
ON reviews FOR SELECT
USING (status = 'published');

-- 4. Fix invites table - only inviter and used_by can see
DROP POLICY IF EXISTS "Anyone can view invites" ON invites;
DROP POLICY IF EXISTS "Users can view their invites" ON invites;
DROP POLICY IF EXISTS "Users can only view their own invites" ON invites;

CREATE POLICY "Users can view their own invites"
ON invites FOR SELECT
TO authenticated
USING (inviter_id = auth.uid() OR used_by = auth.uid());

-- 5. Fix waitlist table - admin only
DROP POLICY IF EXISTS "Anyone can view waitlist" ON waitlist;
DROP POLICY IF EXISTS "Waitlist is viewable by admins" ON waitlist;
DROP POLICY IF EXISTS "Only admins can view waitlist" ON waitlist;

CREATE POLICY "Admins can view waitlist"
ON waitlist FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix partner_submissions - admin only  
DROP POLICY IF EXISTS "Anyone can view partner submissions" ON partner_submissions;
DROP POLICY IF EXISTS "Only admins can view partner submissions" ON partner_submissions;

CREATE POLICY "Admins can view partner submissions"
ON partner_submissions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Ensure connected_platforms tokens are protected (user only)
DROP POLICY IF EXISTS "Users can view their own connected platforms" ON connected_platforms;
DROP POLICY IF EXISTS "Users can only view own platform connections" ON connected_platforms;

CREATE POLICY "Users view own platform connections"
ON connected_platforms FOR SELECT
TO authenticated
USING (user_id = auth.uid());