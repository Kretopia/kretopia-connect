-- Create portfolio reactions table
CREATE TABLE IF NOT EXISTS public.portfolio_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_item_id, user_id)
);

-- Enable RLS
ALTER TABLE public.portfolio_reactions ENABLE ROW LEVEL SECURITY;

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON public.portfolio_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions"
ON public.portfolio_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Users can view all reactions
CREATE POLICY "Users can view all reactions"
ON public.portfolio_reactions
FOR SELECT
TO authenticated
USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_reactions_item_id ON public.portfolio_reactions(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_reactions_user_id ON public.portfolio_reactions(portfolio_item_id, user_id);