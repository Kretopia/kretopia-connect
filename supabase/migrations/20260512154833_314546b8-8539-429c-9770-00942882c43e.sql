ALTER TABLE public.guest_rsvps REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_rsvps;