-- Rename credits column to project_credits to avoid confusion with wallet credits
ALTER TABLE public.profiles
RENAME COLUMN credits TO project_credits;

COMMENT ON COLUMN public.profiles.project_credits IS 'Array of project credits: [{project_name, role, year, platform, url}]';