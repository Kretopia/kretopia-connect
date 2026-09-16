-- Ambassador program applications
CREATE TABLE public.ambassador_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  primary_platform TEXT,
  audience_size TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  niche TEXT,
  pitch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit own application"
ON public.ambassador_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own application"
ON public.ambassador_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
ON public.ambassador_applications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_ambassador_applications_updated_at
BEFORE UPDATE ON public.ambassador_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ambassador_apps_status ON public.ambassador_applications(status);
CREATE INDEX idx_ambassador_apps_user ON public.ambassador_applications(user_id);