-- Add latitude and longitude to profiles for nearby creator discovery
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS location_visible BOOLEAN DEFAULT true;

-- Create index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create function to find nearby creators
CREATE OR REPLACE FUNCTION public.get_nearby_creators(
  user_lat DECIMAL,
  user_lon DECIMAL,
  radius_km DECIMAL DEFAULT 50,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  bio TEXT,
  location TEXT,
  professional_skills JSONB,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_km DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.latitude,
    p.longitude,
    (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000)::DECIMAL as distance_km
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

-- Create function for user to update their location
CREATE OR REPLACE FUNCTION public.update_my_location(
  lat DECIMAL,
  lon DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    latitude = lat,
    longitude = lon,
    location_updated_at = now()
  WHERE user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;