-- Add undo support to swipes table
ALTER TABLE public.swipes 
ADD COLUMN IF NOT EXISTS is_undo BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_swipes_undo ON public.swipes(user_id, is_undo, created_at);

-- Add comment
COMMENT ON COLUMN public.swipes.is_undo IS 'Tracks if this is an undo action (for Pro/Thriver users)';