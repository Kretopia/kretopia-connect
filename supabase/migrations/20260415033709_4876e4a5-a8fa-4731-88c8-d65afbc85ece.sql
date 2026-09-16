
-- Add lat/lng to opportunities for map discovery
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS longitude double precision;

-- Create RPC to find nearby gigs
CREATE OR REPLACE FUNCTION public.get_nearby_gigs(
  user_lat double precision,
  user_lon double precision,
  radius_km integer DEFAULT 50,
  limit_count integer DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  type text,
  compensation text,
  location text,
  location_city text,
  skills text[],
  tags text[],
  image_url text,
  created_by uuid,
  created_at timestamptz,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  creator_name text,
  creator_avatar text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.title,
    o.description,
    o.type,
    o.compensation,
    o.location,
    o.location_city,
    o.skills,
    o.tags,
    o.image_url,
    o.created_by,
    o.created_at,
    o.latitude,
    o.longitude,
    (6371 * acos(
      cos(radians(user_lat)) * cos(radians(o.latitude)) *
      cos(radians(o.longitude) - radians(user_lon)) +
      sin(radians(user_lat)) * sin(radians(o.latitude))
    )) AS distance_km,
    p.full_name AS creator_name,
    p.avatar_url AS creator_avatar
  FROM opportunities o
  LEFT JOIN profiles p ON p.user_id = o.created_by
  WHERE o.status = 'open'
    AND o.latitude IS NOT NULL
    AND o.longitude IS NOT NULL
    AND (6371 * acos(
      cos(radians(user_lat)) * cos(radians(o.latitude)) *
      cos(radians(o.longitude) - radians(user_lon)) +
      sin(radians(user_lat)) * sin(radians(o.latitude))
    )) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
$$;
