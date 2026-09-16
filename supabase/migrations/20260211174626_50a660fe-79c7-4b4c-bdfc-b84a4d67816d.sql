
-- Leads table: unified CRM for clients & collaboration prospects
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'client', -- 'client' or 'collaborator'
  stage TEXT NOT NULL DEFAULT 'cold', -- 'cold', 'warm', 'hot', 'converted', 'lost'
  email TEXT,
  company TEXT,
  role TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT, -- where the lead came from
  avatar_url TEXT,
  profile_url TEXT,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own leads" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outreach sequences table
CREATE TABLE public.outreach_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sequences" ON public.outreach_sequences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_outreach_sequences_updated_at BEFORE UPDATE ON public.outreach_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence emails (steps in a sequence)
CREATE TABLE public.sequence_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER DEFAULT 0, -- days after previous step
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sequence_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sequence emails" ON public.sequence_emails FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sequence_emails_updated_at BEFORE UPDATE ON public.sequence_emails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
