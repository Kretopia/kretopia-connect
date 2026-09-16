
-- Add username column to profiles
ALTER TABLE public.profiles
ADD COLUMN username TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_profiles_username ON public.profiles (username);

-- Create validation function
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    -- Lowercase only
    NEW.username := lower(NEW.username);
    
    -- Validate format: 3-30 chars, alphanumeric + underscore + hyphen
    IF NEW.username !~ '^[a-z0-9_-]{3,30}$' THEN
      RAISE EXCEPTION 'Username must be 3-30 characters, letters, numbers, underscores, or hyphens only';
    END IF;
    
    -- Block reserved words that conflict with routes
    IF NEW.username IN (
      'admin', 'api', 'auth', 'about', 'app', 'billing',
      'circle', 'circles', 'credits', 'community',
      'dashboard', 'desk', 'deck', 'discover', 'directory',
      'events', 'epk', 'endorse',
      'feedback', 'guide',
      'home', 'help',
      'install', 'invite',
      'join',
      'landing', 'legal',
      'magazine', 'messages', 'market', 'marketplace',
      'nearby', 'notifications',
      'onboarding', 'opportunities', 'opportunity',
      'profile', 'privacy', 'production', 'podcast', 'purchases',
      'rewards',
      'search', 'settings', 'site', 'scene', 'subscription', 'spark', 'submit-review',
      'terms', 'thrivepay', 'talent-manager', 'talent-finder',
      'unsubscribe',
      'verify-credit', 'verify-opportunity',
      'wallet', 'www'
    ) THEN
      RAISE EXCEPTION 'This username is reserved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER validate_username_trigger
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_username();
