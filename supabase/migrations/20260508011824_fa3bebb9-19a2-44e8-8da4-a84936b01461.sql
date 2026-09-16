CREATE TABLE IF NOT EXISTS public.event_rsvp_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'short_text' CHECK (question_type IN ('short_text','long_text','multi_select','single_select','dietary','allergies','social_link','meet_intent')),
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  position int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_rsvp_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions for public events"
  ON public.event_rsvp_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND (cj.is_public = true OR cj.created_by = auth.uid())));

CREATE POLICY "Event hosts manage their questions"
  ON public.event_rsvp_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE INDEX idx_event_rsvp_questions_event ON public.event_rsvp_questions(event_id, position);

CREATE TABLE IF NOT EXISTS public.event_rsvp_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.event_rsvp_questions(id) ON DELETE CASCADE,
  user_id uuid,
  guest_email text,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT answer_subject_check CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
);
ALTER TABLE public.event_rsvp_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read all answers for their events"
  ON public.event_rsvp_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE POLICY "Users read their own answers"
  ON public.event_rsvp_answers FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Anyone can insert answers"
  ON public.event_rsvp_answers FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND guest_email IS NOT NULL)
  );

CREATE INDEX idx_event_rsvp_answers_event ON public.event_rsvp_answers(event_id);
CREATE INDEX idx_event_rsvp_answers_question ON public.event_rsvp_answers(question_id);

CREATE TRIGGER trg_event_rsvp_questions_updated BEFORE UPDATE ON public.event_rsvp_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();