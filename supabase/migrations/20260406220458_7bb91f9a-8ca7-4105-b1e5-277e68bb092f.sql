
-- 1. Drop and recreate discovery view (column order must match or we drop first)
DROP VIEW IF EXISTS public.public_profiles_discovery;
CREATE VIEW public.public_profiles_discovery AS
SELECT 
  p.user_id,
  p.full_name,
  p.role,
  p.bio,
  p.avatar_url,
  p.location,
  p.collab_intent,
  p.level,
  p.verification_score,
  p.badge,
  p.created_at,
  p.professional_skills
FROM profiles p
WHERE p.onboarding_completed = true
  AND p.bio IS NOT NULL AND LENGTH(p.bio) >= 10
  AND p.full_name IS NOT NULL AND p.full_name != 'New User' AND p.full_name != ''
  AND EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id);

GRANT SELECT ON public.public_profiles_discovery TO anon, authenticated;

-- 2. Update get_nearby_creators to remove avatar gate
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
    AND p.bio IS NOT NULL AND LENGTH(p.bio) >= 10
    AND EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id)
    AND (calculate_distance(user_lat, user_lon, p.latitude, p.longitude) / 1000) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$function$;

-- 3. Create auto-join circles function
CREATE OR REPLACE FUNCTION public.auto_join_circles_for_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cid uuid;
  circle_ids uuid[];
BEGIN
  circle_ids := CASE 
    WHEN p_role ILIKE '%film%' OR p_role ILIKE '%video%' OR p_role ILIKE '%director%' OR p_role ILIKE '%cinemat%' THEN
      ARRAY['000a724b-f717-4aec-b3f4-119e43be0dc0']::uuid[]
    WHEN p_role ILIKE '%music%' OR p_role ILIKE '%producer%' OR p_role ILIKE '%dj%' OR p_role ILIKE '%artist%' OR p_role ILIKE '%singer%' OR p_role ILIKE '%songwriter%' THEN
      ARRAY['ed055b91-4215-43d9-9118-b041222ec989']::uuid[]
    WHEN p_role ILIKE '%design%' OR p_role ILIKE '%illustrat%' OR p_role ILIKE '%graphic%' THEN
      ARRAY['defecbca-8a07-4545-a172-e2a26bb16478']::uuid[]
    WHEN p_role ILIKE '%photo%' THEN
      ARRAY['7a8529e6-510e-4eee-b682-23a2cfefa41f']::uuid[]
    WHEN p_role ILIKE '%writ%' OR p_role ILIKE '%content%' OR p_role ILIKE '%copy%' OR p_role ILIKE '%blog%' THEN
      ARRAY['3eed8315-da75-4d5f-a855-b8fd7ca45054']::uuid[]
    WHEN p_role ILIKE '%podcast%' THEN
      ARRAY['7be8cd02-0618-42ab-b3e5-41779a862762']::uuid[]
    WHEN p_role ILIKE '%develop%' OR p_role ILIKE '%engineer%' OR p_role ILIKE '%tech%' THEN
      ARRAY['c12ff7ba-917e-41b8-a96b-2b2d271c5dc7']::uuid[]
    WHEN p_role ILIKE '%event%' THEN
      ARRAY['8b99638b-dcea-42b6-af0d-2f76e8f2d713']::uuid[]
    ELSE
      ARRAY['6fea0cb3-4fe6-4b76-a85d-3a5361f93e3b']::uuid[]
  END;

  -- Always also join Collabs & Networking
  IF NOT ('6fea0cb3-4fe6-4b76-a85d-3a5361f93e3b' = ANY(circle_ids)) THEN
    circle_ids := circle_ids || ARRAY['6fea0cb3-4fe6-4b76-a85d-3a5361f93e3b']::uuid[];
  END IF;

  FOREACH cid IN ARRAY circle_ids LOOP
    INSERT INTO spark_room_members (room_id, user_id, role)
    VALUES (cid, p_user_id, 'member')
    ON CONFLICT DO NOTHING;
    
    UPDATE spark_rooms SET member_count = member_count + 1 WHERE id = cid;
  END LOOP;
END;
$$;
