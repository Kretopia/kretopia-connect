
-- Helpful votes on reviews
CREATE TABLE public.location_review_helpful (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES public.location_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.location_review_helpful ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view helpful votes"
  ON public.location_review_helpful FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add helpful votes"
  ON public.location_review_helpful FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove helpful votes"
  ON public.location_review_helpful FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Booking requests for rentable locations
CREATE TABLE public.location_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES public.creative_locations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  total_price NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.location_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.location_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Location owners can view bookings"
  ON public.location_bookings FOR SELECT TO authenticated
  USING (location_id IN (SELECT id FROM creative_locations WHERE user_id = auth.uid() OR claimed_by_user_id = auth.uid()));
CREATE POLICY "Users can create bookings"
  ON public.location_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Location owners can update booking status"
  ON public.location_bookings FOR UPDATE TO authenticated
  USING (location_id IN (SELECT id FROM creative_locations WHERE user_id = auth.uid() OR claimed_by_user_id = auth.uid()));

-- Add hours and booking config to locations
ALTER TABLE public.creative_locations 
  ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_booking_hours INTEGER DEFAULT 1;

-- Storage bucket for location photos
INSERT INTO storage.buckets (id, name, public) VALUES ('location-photos', 'location-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view location photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'location-photos');
CREATE POLICY "Authenticated users can upload location photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'location-photos');
CREATE POLICY "Users can delete own location photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'location-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at
CREATE TRIGGER update_location_bookings_updated_at
  BEFORE UPDATE ON public.location_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
