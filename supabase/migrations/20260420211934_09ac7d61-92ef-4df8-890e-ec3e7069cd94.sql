-- DeskAI usage tracking (daily message cap for free tier)
CREATE TABLE public.desk_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.desk_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DeskAI usage"
  ON public.desk_ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- DeskAI conversations stored per project per user (so each side can keep their own assistant thread)
CREATE TABLE public.desk_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_desk_ai_messages_project_user ON public.desk_ai_messages(project_id, user_id, created_at);

ALTER TABLE public.desk_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DeskAI messages"
  ON public.desk_ai_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own DeskAI messages"
  ON public.desk_ai_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own DeskAI messages"
  ON public.desk_ai_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_desk_ai_usage_updated_at
  BEFORE UPDATE ON public.desk_ai_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();