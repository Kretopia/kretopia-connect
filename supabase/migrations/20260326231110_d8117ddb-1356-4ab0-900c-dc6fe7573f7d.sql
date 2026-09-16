-- Update discovery view to enforce quality gates (avatar + bio 20+ chars)
CREATE OR REPLACE VIEW public.public_profiles_discovery AS
SELECT user_id,
    full_name,
    avatar_url,
    role,
    bio,
    location,
    professional_skills,
    passion_skills,
    badge,
    verification_score,
    level,
    xp,
    account_type,
    company_name,
    company_logo_url,
    job_title,
    industry,
    collab_intent,
    onboarding_completed,
    created_at
   FROM profiles
  WHERE onboarding_completed = true 
    AND is_claimed = true
    AND avatar_url IS NOT NULL 
    AND avatar_url != ''
    AND bio IS NOT NULL 
    AND length(bio) >= 20;

-- Add ticket_price and ticket_currency columns to creative_jams for event ticketing
ALTER TABLE public.creative_jams ADD COLUMN IF NOT EXISTS ticket_price numeric DEFAULT 0;
ALTER TABLE public.creative_jams ADD COLUMN IF NOT EXISTS ticket_currency text DEFAULT 'USD';
ALTER TABLE public.creative_jams ADD COLUMN IF NOT EXISTS is_ticketed boolean DEFAULT false;
ALTER TABLE public.creative_jams ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'session';