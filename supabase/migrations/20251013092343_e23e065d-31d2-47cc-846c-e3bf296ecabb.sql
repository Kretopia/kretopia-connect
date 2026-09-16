-- Add AI validation fields to waitlist table
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS ai_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_decision TEXT CHECK (ai_decision IN ('approve', 'review', 'reject')),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS invite_code TEXT,
ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP WITH TIME ZONE;

-- Update status field to include 'auto_approved'
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_status_check;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_status_check CHECK (status IN ('pending', 'approved', 'auto_approved', 'rejected', 'review'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_invite_code ON public.waitlist(invite_code);