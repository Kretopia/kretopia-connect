-- Add new profile fields for press, credits, and awards
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS press_links JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS credits JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.press_links IS 'Array of press/media links: [{title, url, publication, date}]';
COMMENT ON COLUMN public.profiles.credits IS 'Array of credits: [{project_name, role, year, platform, url}]';
COMMENT ON COLUMN public.profiles.awards IS 'Array of awards: [{title, organization, year, description}]';