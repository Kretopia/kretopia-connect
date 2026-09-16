
-- Creator Services table
CREATE TABLE public.creator_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  delivery_time TEXT,
  service_format TEXT DEFAULT 'virtual',
  cover_image_url TEXT,
  sample_urls TEXT[],
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services" ON public.creator_services
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners can manage their services" ON public.creator_services
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_creator_services_updated_at
  BEFORE UPDATE ON public.creator_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service Tiers (1-3 per service)
CREATE TABLE public.service_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.creator_services(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL DEFAULT 'Standard',
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  deliverables TEXT[] DEFAULT '{}',
  delivery_days INTEGER,
  tier_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service tiers" ON public.service_tiers
  FOR SELECT USING (true);

CREATE POLICY "Service owners can manage tiers" ON public.service_tiers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.creator_services WHERE id = service_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.creator_services WHERE id = service_id AND user_id = auth.uid())
  );

-- Custom Project Requests
CREATE TABLE public.custom_project_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  project_type TEXT,
  budget_range TEXT,
  timeline TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_project_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can create requests" ON public.custom_project_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requesters can view own requests" ON public.custom_project_requests
  FOR SELECT USING (auth.uid() = requester_id);

CREATE POLICY "Creators can view requests to them" ON public.custom_project_requests
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Creators can update request status" ON public.custom_project_requests
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE TRIGGER update_custom_project_requests_updated_at
  BEFORE UPDATE ON public.custom_project_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_creator_services_user_id ON public.creator_services(user_id);
CREATE INDEX idx_service_tiers_service_id ON public.service_tiers(service_id);
CREATE INDEX idx_custom_project_requests_creator ON public.custom_project_requests(creator_id);
