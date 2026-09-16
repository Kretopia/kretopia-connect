-- 1. Add declined_at to connections for silent decline tracking (sender won't know)
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_message_request BOOLEAN DEFAULT false;

-- 2. Create creative_jams table for events/jams feature
CREATE TABLE public.creative_jams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  venue_name TEXT,
  venue_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  max_participants INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  cover_image_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create jam_participants table for tracking who joined
CREATE TABLE public.jam_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jam_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'interested' CHECK (status IN ('interested', 'going', 'maybe', 'declined')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(jam_id, user_id)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.creative_jams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_participants ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for creative_jams
CREATE POLICY "Public jams visible to all authenticated users"
ON public.creative_jams FOR SELECT
TO authenticated
USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create their own jams"
ON public.creative_jams FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own jams"
ON public.creative_jams FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own jams"
ON public.creative_jams FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- 6. Create RLS policies for jam_participants
CREATE POLICY "Users can view participants of public jams"
ON public.jam_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams 
    WHERE id = jam_id AND (is_public = true OR created_by = auth.uid())
  )
);

CREATE POLICY "Users can join jams"
ON public.jam_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation"
ON public.jam_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can leave jams"
ON public.jam_participants FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 7. Create updated_at trigger for creative_jams
CREATE TRIGGER update_creative_jams_updated_at
BEFORE UPDATE ON public.creative_jams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Enable realtime for creative_jams and jam_participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.creative_jams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_participants;

-- 9. Create index for faster geospatial queries on jams
CREATE INDEX IF NOT EXISTS idx_creative_jams_location ON public.creative_jams(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creative_jams_status ON public.creative_jams(status);
CREATE INDEX IF NOT EXISTS idx_creative_jams_start_time ON public.creative_jams(start_time);

-- 10. Function to get nearby jams
CREATE OR REPLACE FUNCTION public.get_nearby_jams(
  user_lat DECIMAL,
  user_lon DECIMAL,
  radius_km DECIMAL DEFAULT 50,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  venue_name TEXT,
  venue_address TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  max_participants INTEGER,
  is_public BOOLEAN,
  status TEXT,
  cover_image_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  distance_km DECIMAL,
  participant_count BIGINT,
  creator_name TEXT,
  creator_avatar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.created_by,
    j.title,
    j.description,
    j.category,
    j.venue_name,
    j.venue_address,
    j.latitude,
    j.longitude,
    j.start_time,
    j.end_time,
    j.max_participants,
    j.is_public,
    j.status,
    j.cover_image_url,
    j.tags,
    j.created_at,
    (calculate_distance(user_lat, user_lon, j.latitude, j.longitude) / 1000)::DECIMAL as distance_km,
    (SELECT COUNT(*) FROM jam_participants jp WHERE jp.jam_id = j.id AND jp.status IN ('going', 'interested'))::BIGINT as participant_count,
    p.full_name as creator_name,
    p.avatar_url as creator_avatar
  FROM creative_jams j
  LEFT JOIN profiles p ON p.user_id = j.created_by
  WHERE j.latitude IS NOT NULL 
    AND j.longitude IS NOT NULL
    AND j.is_public = true
    AND j.status IN ('upcoming', 'active')
    AND j.start_time > now() - INTERVAL '1 day'
    AND (calculate_distance(user_lat, user_lon, j.latitude, j.longitude) / 1000) <= radius_km
  ORDER BY j.start_time ASC
  LIMIT limit_count;
END;
$$;