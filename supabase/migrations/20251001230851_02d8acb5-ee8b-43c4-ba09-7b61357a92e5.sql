-- Create swipes table if not exists
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('creator', 'opportunity')),
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  is_super_like BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own swipes" ON public.swipes;
  DROP POLICY IF EXISTS "Users can create swipes" ON public.swipes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Users can view their own swipes"
  ON public.swipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create swipes"
  ON public.swipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_swipes_user_target ON public.swipes(user_id, target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_swipes_target_user ON public.swipes(target_id, user_id);