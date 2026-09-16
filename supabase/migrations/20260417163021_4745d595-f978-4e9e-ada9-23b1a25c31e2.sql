
CREATE TABLE public.weekly_founder_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL UNIQUE,
  title TEXT,
  body TEXT NOT NULL,
  author_user_id UUID NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_founder_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published founder notes"
ON public.weekly_founder_notes FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can insert founder notes"
ON public.weekly_founder_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update founder notes"
ON public.weekly_founder_notes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete founder notes"
ON public.weekly_founder_notes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_weekly_founder_notes_updated_at
BEFORE UPDATE ON public.weekly_founder_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_weekly_founder_notes_week ON public.weekly_founder_notes(week_start_date DESC);
