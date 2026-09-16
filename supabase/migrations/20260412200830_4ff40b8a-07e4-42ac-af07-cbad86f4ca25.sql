
-- Email segments for organizing contacts
CREATE TABLE public.email_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  contact_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_segments"
  ON public.email_segments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Individual email contacts
CREATE TABLE public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  segment_id UUID REFERENCES public.email_segments(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, segment_id)
);

CREATE INDEX idx_email_contacts_segment ON public.email_contacts(segment_id);
CREATE INDEX idx_email_contacts_status ON public.email_contacts(status);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_contacts"
  ON public.email_contacts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drip campaigns
CREATE TABLE public.drip_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id UUID REFERENCES public.email_segments(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT 'Visit ThriveIN →',
  cta_url TEXT NOT NULL DEFAULT 'https://www.thrivein.io',
  status TEXT NOT NULL DEFAULT 'draft',
  daily_limit INTEGER NOT NULL DEFAULT 95,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_batch_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage drip_campaigns"
  ON public.drip_campaigns FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Track which contacts have been sent to in a campaign
CREATE TABLE public.drip_campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.drip_campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.email_contacts(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_drip_sends_campaign ON public.drip_campaign_sends(campaign_id);
CREATE INDEX idx_drip_sends_status ON public.drip_campaign_sends(status, campaign_id);

ALTER TABLE public.drip_campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage drip_campaign_sends"
  ON public.drip_campaign_sends FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_email_segments_updated_at
  BEFORE UPDATE ON public.email_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drip_campaigns_updated_at
  BEFORE UPDATE ON public.drip_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
