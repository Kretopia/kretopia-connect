-- Enable pgvector for semantic memory search
CREATE EXTENSION IF NOT EXISTS vector;

-- Long-term memory store for Thrive Copilot (Thrive Brain)
CREATE TABLE IF NOT EXISTS public.copilot_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fact',
  -- kinds: fact | preference | relationship | working_style | money | project | goal | dislike
  content TEXT NOT NULL,
  embedding vector(768),
  source TEXT,
  -- e.g. 'chat:<conversation_id>' | 'manual' | 'call:<call_id>' | 'system'
  confidence REAL NOT NULL DEFAULT 0.7,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS copilot_memories_user_idx ON public.copilot_memories(user_id);
CREATE INDEX IF NOT EXISTS copilot_memories_kind_idx ON public.copilot_memories(user_id, kind);
CREATE INDEX IF NOT EXISTS copilot_memories_embedding_idx
  ON public.copilot_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS
ALTER TABLE public.copilot_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memories"
  ON public.copilot_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own memories"
  ON public.copilot_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own memories"
  ON public.copilot_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own memories"
  ON public.copilot_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Updated-at trigger
CREATE TRIGGER update_copilot_memories_updated_at
  BEFORE UPDATE ON public.copilot_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Semantic search function (security definer so edge functions with service role work fine,
-- but we still scope by p_user_id parameter to prevent cross-user leakage)
CREATE OR REPLACE FUNCTION public.match_copilot_memories(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_match_count INT DEFAULT 6,
  p_min_similarity REAL DEFAULT 0.55
)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  content TEXT,
  confidence REAL,
  similarity REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.kind,
    m.content,
    m.confidence,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.copilot_memories m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_query_embedding) > p_min_similarity
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- Bump use_count when a memory is surfaced
CREATE OR REPLACE FUNCTION public.touch_copilot_memory(p_memory_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.copilot_memories
     SET last_used_at = now(),
         use_count = use_count + 1
   WHERE id = p_memory_id;
$$;