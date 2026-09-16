-- Remove security definer view and instead use app-level filtering
DROP VIEW IF EXISTS public_profiles;

-- Note: App should query profiles and filter sensitive fields in code
-- This is more secure than security definer views