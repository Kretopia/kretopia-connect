
-- Creative Locations table (studios, creative spaces, shoot spots)
CREATE TABLE public.creative_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL DEFAULT 'shoot_spot',
  category TEXT DEFAULT 'general',
  address TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  is_rentable BOOLEAN DEFAULT false,
  price_per_hour NUMERIC,
  price_currency TEXT DEFAULT 'USD',
  contact_info TEXT,
  website_url TEXT,
  average_rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Location Reviews table
CREATE TABLE public.location_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES public.creative_locations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, user_id)
);

-- Enable RLS
ALTER TABLE public.creative_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_reviews ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can view active locations
CREATE POLICY "Anyone can view active locations"
  ON public.creative_locations FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS: Users can create their own locations
CREATE POLICY "Users can create own locations"
  ON public.creative_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own locations
CREATE POLICY "Users can update own locations"
  ON public.creative_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Users can delete their own locations
CREATE POLICY "Users can delete own locations"
  ON public.creative_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Anyone authenticated can view reviews
CREATE POLICY "Anyone can view reviews"
  ON public.location_reviews FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Users can create their own reviews
CREATE POLICY "Users can create own reviews"
  ON public.location_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON public.location_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON public.location_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to update average rating
CREATE OR REPLACE FUNCTION public.update_location_rating()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE creative_locations
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM location_reviews
      WHERE location_id = COALESCE(NEW.location_id, OLD.location_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM location_reviews
      WHERE location_id = COALESCE(NEW.location_id, OLD.location_id)
    )
  WHERE id = COALESCE(NEW.location_id, OLD.location_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_location_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.location_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_location_rating();

-- Updated_at trigger
CREATE TRIGGER update_creative_locations_updated_at
  BEFORE UPDATE ON public.creative_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_location_reviews_updated_at
  BEFORE UPDATE ON public.location_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to get nearby locations
CREATE OR REPLACE FUNCTION public.get_nearby_locations(
  user_lat NUMERIC,
  user_lon NUMERIC,
  radius_km NUMERIC DEFAULT 50,
  limit_count INTEGER DEFAULT 50,
  type_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name TEXT,
  description TEXT,
  location_type TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  cover_image_url TEXT,
  image_urls TEXT[],
  tags TEXT[],
  amenities TEXT[],
  is_rentable BOOLEAN,
  price_per_hour NUMERIC,
  price_currency TEXT,
  average_rating NUMERIC,
  review_count INTEGER,
  is_verified BOOLEAN,
  creator_name TEXT,
  creator_avatar TEXT,
  distance_km NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.user_id,
    cl.name,
    cl.description,
    cl.location_type,
    cl.category,
    cl.address,
    cl.city,
    cl.latitude,
    cl.longitude,
    cl.cover_image_url,
    cl.image_urls,
    cl.tags,
    cl.amenities,
    cl.is_rentable,
    cl.price_per_hour,
    cl.price_currency,
    cl.average_rating,
    cl.review_count,
    cl.is_verified,
    p.full_name AS creator_name,
    p.avatar_url AS creator_avatar,
    (calculate_distance(user_lat, user_lon, cl.latitude, cl.longitude) / 1000)::NUMERIC AS distance_km
  FROM creative_locations cl
  LEFT JOIN profiles p ON p.user_id = cl.user_id
  WHERE cl.is_active = true
    AND (type_filter IS NULL OR cl.location_type = type_filter)
    AND (calculate_distance(user_lat, user_lon, cl.latitude, cl.longitude) / 1000) <= radius_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$;
