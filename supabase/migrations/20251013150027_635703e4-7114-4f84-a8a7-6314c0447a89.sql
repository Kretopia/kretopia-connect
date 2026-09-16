-- Enable realtime for skill_endorsements table
ALTER TABLE public.skill_endorsements REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_endorsements;