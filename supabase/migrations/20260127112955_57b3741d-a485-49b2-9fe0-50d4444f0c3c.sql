-- Update get_nearby_creators to only return profiles meeting discovery requirements
-- (avatar, bio 20+ chars, and at least 1 portfolio item OR 1 credit)
CREATE OR REPLACE FUNCTION public.get_nearby_creators(user_lat numeric, user_lon numeric, radius_km numeric DEFAULT 50, limit_count integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role text, bio text, location text, professional_skills jsonb, latitude numeric, longitude numeric, distance_km numeric, location_precision location_precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- DISCOVERY REQUIREMENTS: Quality gates for visibility
    -- Must have avatar
    AND p.avatar_url IS NOT NULL AND p.avatar_url != ''
    -- Must have bio with 20+ characters
    AND p.bio IS NOT NULL AND LENGTH(p.bio) >= 20
    -- Must have at least 1 portfolio item OR 1 credit
    AND (
      EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.user_id = p.user_id)
      OR EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id)
    )
    AND (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$function$;