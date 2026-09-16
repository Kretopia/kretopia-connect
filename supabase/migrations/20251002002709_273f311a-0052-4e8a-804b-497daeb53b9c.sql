-- Create partner_locations table
CREATE TABLE public.partner_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- cafe, coworking, studio, hotel, spa, gym, etc
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  image_url TEXT,
  logo_url TEXT,
  amenities JSONB DEFAULT '[]'::jsonb,
  offerings TEXT[],
  tier_required TEXT NOT NULL DEFAULT 'free', -- free, standard, premium
  points_per_visit INTEGER NOT NULL DEFAULT 10,
  check_in_radius_meters INTEGER DEFAULT 100, -- geofence radius
  qr_code TEXT UNIQUE NOT NULL DEFAULT SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 12),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_check_ins table
CREATE TABLE public.user_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.partner_locations(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  verified_location BOOLEAN DEFAULT false,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint for one check-in per location per day
CREATE UNIQUE INDEX idx_user_check_ins_daily 
ON public.user_check_ins(user_id, location_id, check_in_date);

-- Enable RLS
ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_check_ins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_locations
CREATE POLICY "Partner locations are viewable by everyone"
ON public.partner_locations
FOR SELECT
USING (is_active = true);

CREATE POLICY "Only admins can manage partner locations"
ON public.partner_locations
FOR ALL
USING (false); -- Will add admin role check later

-- RLS Policies for user_check_ins
CREATE POLICY "Users can view their own check-ins"
ON public.user_check_ins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-ins"
ON public.user_check_ins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_partner_locations_updated_at
BEFORE UPDATE ON public.partner_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for geospatial queries
CREATE INDEX idx_partner_locations_coordinates ON public.partner_locations(latitude, longitude);
CREATE INDEX idx_user_check_ins_user_location ON public.user_check_ins(user_id, location_id);

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  R CONSTANT DECIMAL := 6371000; -- Earth's radius in meters
  dLat DECIMAL;
  dLon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat/2) * sin(dLat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$;