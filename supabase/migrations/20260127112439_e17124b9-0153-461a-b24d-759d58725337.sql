-- First ensure the enum type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_precision') THEN
    CREATE TYPE public.location_precision AS ENUM ('exact', 'approximate', 'area_only');
  END IF;
END $$;

-- Add location_precision column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'location_precision'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN location_precision public.location_precision DEFAULT 'approximate';
  END IF;
END $$;

-- Drop the existing function first (required to change return type)
DROP FUNCTION IF EXISTS public.get_nearby_creators(numeric, numeric, numeric, integer);

-- Recreate with location_precision in return type and fuzzing logic
CREATE FUNCTION public.get_nearby_creators(
  user_lat numeric, 
  user_lon numeric, 
  radius_km numeric DEFAULT 50, 
  limit_count integer DEFAULT 50
)
RETURNS TABLE(
  user_id uuid, 
  full_name text, 
  avatar_url text, 
  role text, 
  bio text, 
  location text, 
  professional_skills jsonb, 
  latitude numeric, 
  longitude numeric, 
  distance_km numeric,
  location_precision public.location_precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fuzz_factor_approx CONSTANT DECIMAL := 0.015; -- ~1.5km fuzzing for approximate
  fuzz_factor_area CONSTANT DECIMAL := 0.05;   -- ~5km fuzzing for area_only
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.role,
    p.bio,
    p.location,
    p.professional_skills,
    -- Apply location fuzzing based on precision setting
    CASE p.location_precision
      WHEN 'exact' THEN p.latitude
      WHEN 'approximate' THEN p.latitude + (random() - 0.5) * fuzz_factor_approx
      WHEN 'area_only' THEN p.latitude + (random() - 0.5) * fuzz_factor_area
      ELSE p.latitude + (random() - 0.5) * fuzz_factor_approx -- default to approximate
    END as latitude,
    CASE p.location_precision
      WHEN 'exact' THEN p.longitude
      WHEN 'approximate' THEN p.longitude + (random() - 0.5) * fuzz_factor_approx
      WHEN 'area_only' THEN p.longitude + (random() - 0.5) * fuzz_factor_area
      ELSE p.longitude + (random() - 0.5) * fuzz_factor_approx
    END as longitude,
    -- Distance is calculated from actual location for accuracy
    (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000)::DECIMAL as distance_km,
    COALESCE(p.location_precision, 'approximate'::public.location_precision) as location_precision
  FROM profiles p
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.location_visible = true
    AND p.user_id != auth.uid()
    AND p.onboarding_completed = true
    AND (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$;