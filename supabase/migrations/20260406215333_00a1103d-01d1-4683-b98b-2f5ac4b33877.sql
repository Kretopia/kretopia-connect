
CREATE OR REPLACE FUNCTION public.get_nearby_creators(user_lat numeric, user_lon numeric, radius_km numeric DEFAULT 50, limit_count integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role text, bio text, location text, professional_skills jsonb, latitude numeric, longitude numeric, distance_km numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fuzz_factor_approx CONSTANT NUMERIC := 0.015;
  fuzz_factor_area CONSTANT NUMERIC := 0.05;
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
    (CASE COALESCE(p.location_precision, 'approximate'::public.location_precision)
      WHEN 'exact' THEN p.latitude
      WHEN 'approximate' THEN p.latitude + ((random() - 0.5) * fuzz_factor_approx)::NUMERIC
      WHEN 'area_only' THEN p.latitude + ((random() - 0.5) * fuzz_factor_area)::NUMERIC
      ELSE p.latitude + ((random() - 0.5) * fuzz_factor_approx)::NUMERIC
    END)::NUMERIC as latitude,
    (CASE COALESCE(p.location_precision, 'approximate'::public.location_precision)
      WHEN 'exact' THEN p.longitude
      WHEN 'approximate' THEN p.longitude + ((random() - 0.5) * fuzz_factor_approx)::NUMERIC
      WHEN 'area_only' THEN p.longitude + ((random() - 0.5) * fuzz_factor_area)::NUMERIC
      ELSE p.longitude + ((random() - 0.5) * fuzz_factor_approx)::NUMERIC
    END)::NUMERIC as longitude,
    (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000)::NUMERIC as distance_km
  FROM profiles p
  WHERE p.latitude IS NOT NULL 
    AND p.longitude IS NOT NULL
    AND p.location_visible = true
    AND p.user_id != auth.uid()
    AND p.onboarding_completed = true
    AND p.avatar_url IS NOT NULL AND p.avatar_url != ''
    AND p.bio IS NOT NULL AND LENGTH(p.bio) >= 20
    AND EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id)
    AND (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$function$;
