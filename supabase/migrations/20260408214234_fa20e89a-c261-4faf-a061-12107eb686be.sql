
-- 1. FIX: Profiles
DROP POLICY IF EXISTS "Any authenticated user can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles for discovery" ON public.profiles;

DROP VIEW IF EXISTS public.public_profiles_safe;
CREATE VIEW public.public_profiles_safe
WITH (security_invoker = on) AS
SELECT 
  user_id, full_name, avatar_url, role, bio, location, 
  professional_skills, badge, xp, level, 
  onboarding_completed, account_type, 
  instagram_url, tiktok_url, youtube_url, twitter_url, linkedin_url,
  id_verified, verification_status, verification_tier, membership_number,
  cover_image_url, behance_url, imdb_url, soundcloud_url, spotify_url,
  created_at, updated_at
FROM public.profiles;

CREATE POLICY "Authenticated users view safe profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public discovery via safe view"
ON public.profiles FOR SELECT TO anon USING (onboarding_completed = true);

-- 2. FIX: Circle messages
DROP POLICY IF EXISTS "Room members can view messages" ON public.spark_room_messages;
CREATE POLICY "Room members can view messages"
ON public.spark_room_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.spark_room_members WHERE room_id = spark_room_messages.room_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.spark_rooms WHERE id = spark_room_messages.room_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can post messages" ON public.spark_room_messages;
CREATE POLICY "Room members can post messages"
ON public.spark_room_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM public.spark_room_members WHERE room_id = spark_room_messages.room_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spark_rooms WHERE id = spark_room_messages.room_id AND created_by = auth.uid())
  )
);

-- 3. FIX: Circle members
DROP POLICY IF EXISTS "Anyone authenticated can view room members" ON public.spark_room_members;
CREATE POLICY "Room members can view room members"
ON public.spark_room_members FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.spark_room_members m2 WHERE m2.room_id = spark_room_members.room_id AND m2.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.spark_rooms WHERE id = spark_room_members.room_id AND created_by = auth.uid())
);

-- 4. FIX: Project templates
DROP POLICY IF EXISTS "Anyone can increment usage count on public templates" ON public.project_templates;

CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE project_templates SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = template_id AND is_public = true;
END;
$$;

-- 5. FIX: Brand verification tokens
DROP POLICY IF EXISTS "Public token-based verification read" ON public.icdb_brand_verifications;

CREATE OR REPLACE FUNCTION public.get_brand_verification_by_token(p_token text)
RETURNS TABLE(id uuid, project_id uuid, brand_name text, brand_email text, status text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT bv.id, bv.project_id, bv.brand_name, bv.brand_email, bv.status, bv.created_at
  FROM icdb_brand_verifications bv WHERE bv.verification_token = p_token;
END;
$$;
