
-- Track credits users deliberately delete so AI doesn't re-add them
CREATE TABLE public.deleted_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_name_lower text NOT NULL,
  role_lower text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_name_lower, role_lower)
);

ALTER TABLE public.deleted_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deleted credits"
  ON public.deleted_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deleted credits"
  ON public.deleted_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can also insert (for edge functions)
CREATE POLICY "Service can manage deleted credits"
  ON public.deleted_credits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Clean up Rene's duplicate ai_discovered credits (keep oldest of each project+role)
DELETE FROM credits
WHERE user_id = '472f05ca-09aa-401b-abbd-76a4e62f31e5'
  AND source = 'ai_discovered'
  AND id NOT IN (
    SELECT DISTINCT ON (lower(project_name), lower(role))
      id
    FROM credits
    WHERE user_id = '472f05ca-09aa-401b-abbd-76a4e62f31e5'
      AND source = 'ai_discovered'
    ORDER BY lower(project_name), lower(role), created_at ASC
  );
