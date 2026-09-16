
CREATE TABLE IF NOT EXISTS public.thrive_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  mem_key text NOT NULL,
  label text NOT NULL,
  body text,
  context jsonb DEFAULT '{}'::jsonb,
  importance int NOT NULL DEFAULT 1,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thrive_memory_unique UNIQUE (user_id, kind, mem_key)
);

CREATE INDEX IF NOT EXISTS idx_thrive_memory_user_kind ON public.thrive_memory(user_id, kind);

ALTER TABLE public.thrive_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thrive_memory_select" ON public.thrive_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "thrive_memory_insert" ON public.thrive_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "thrive_memory_update" ON public.thrive_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "thrive_memory_delete" ON public.thrive_memory FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_thrive_memory_updated
  BEFORE UPDATE ON public.thrive_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
