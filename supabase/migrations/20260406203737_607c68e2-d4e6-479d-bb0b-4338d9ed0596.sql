
-- Recreate public_profiles_discovery view using credits table
CREATE OR REPLACE VIEW public.public_profiles_discovery AS
SELECT 
  p.user_id,
  p.full_name,
  p.role,
  p.bio,
  p.avatar_url,
  p.location,
  p.collab_intent,
  p.level,
  p.verification_score,
  p.created_at
FROM profiles p
WHERE p.onboarding_completed = true
  AND p.avatar_url IS NOT NULL
  AND p.avatar_url != ''
  AND p.bio IS NOT NULL
  AND LENGTH(p.bio) >= 20
  AND EXISTS (
    SELECT 1 FROM credits c WHERE c.user_id = p.user_id
  );

-- Recreate portfolio_reactions as credit_reactions
CREATE TABLE IF NOT EXISTS public.credit_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(credit_id, user_id)
);

ALTER TABLE public.credit_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view credit reactions"
  ON public.credit_reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can react"
  ON public.credit_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.credit_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
