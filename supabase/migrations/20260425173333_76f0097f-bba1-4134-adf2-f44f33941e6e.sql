CREATE UNIQUE INDEX IF NOT EXISTS credits_user_source_id_source_idx
  ON public.credits (user_id, source_id, source)
  WHERE source_id IS NOT NULL AND source IS NOT NULL;