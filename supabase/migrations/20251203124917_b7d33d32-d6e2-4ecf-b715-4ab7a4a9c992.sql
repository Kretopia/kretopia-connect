-- Fix security issues identified in audit

-- 1. Drop existing public profiles view and recreate without sensitive fields
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles AS 
SELECT 
    user_id,
    full_name,
    role,
    bio,
    location,
    avatar_url,
    website,
    linkedin_url,
    behance_url,
    imdb_url,
    instagram_url,
    twitter_url,
    spotify_url,
    soundcloud_url,
    youtube_url,
    tiktok_url,
    professional_skills,
    passion_skills,
    badge,
    level,
    xp,
    average_rating,
    total_reviews,
    created_at,
    account_type,
    company_name,
    company_logo_url,
    company_about,
    company_address,
    company_location_lat,
    company_location_lng,
    company_images,
    company_size,
    company_industry,
    verified_at,
    portfolio_verified,
    social_verified,
    verification_status,
    job_title,
    industry
FROM profiles
WHERE verification_status <> 'rejected';

-- 2. Create safe view for skill_endorsements without email
DROP VIEW IF EXISTS public_skill_endorsements;
CREATE VIEW public_skill_endorsements AS
SELECT 
    id,
    profile_id,
    request_id,
    skill_name,
    endorser_name,
    endorser_company,
    project_name,
    proficiency_level,
    testimonial,
    relationship,
    created_at,
    verified
    -- Explicitly excluding: endorser_email
FROM skill_endorsements;

-- 3. Fix invites table - only inviter can see their own invites
DROP POLICY IF EXISTS "Users can view own invites" ON invites;
DROP POLICY IF EXISTS "Users can view invites they sent" ON invites;
CREATE POLICY "Users can only view their own sent invites" ON invites
    FOR SELECT USING (auth.uid() = inviter_id);

-- 4. Fix waitlist table - strengthen RLS
DROP POLICY IF EXISTS "Users can view own waitlist entry" ON waitlist;
DROP POLICY IF EXISTS "Admins can view all waitlist entries" ON waitlist;
CREATE POLICY "Users can view own waitlist entry" ON waitlist
    FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Admins can view all waitlist entries" ON waitlist
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- 5. Create safe view for reviews without email
DROP VIEW IF EXISTS public_reviews;
CREATE VIEW public_reviews AS
SELECT 
    id,
    profile_id,
    reviewer_id,
    reviewer_name,
    reviewer_role,
    reviewer_company,
    reviewer_avatar_url,
    rating,
    review_text,
    project_name,
    collaboration_type,
    is_endorsed,
    is_verified,
    status,
    created_at,
    updated_at
    -- Explicitly excluding: reviewer_email, submission_token
FROM reviews
WHERE status = 'approved';

-- 6. Fix partner_submissions - tighten access
DROP POLICY IF EXISTS "Submitters can view own submissions" ON partner_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON partner_submissions;
CREATE POLICY "Submitters can view own submissions" ON partner_submissions
    FOR SELECT USING (
        contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
CREATE POLICY "Admins can view all submissions" ON partner_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );