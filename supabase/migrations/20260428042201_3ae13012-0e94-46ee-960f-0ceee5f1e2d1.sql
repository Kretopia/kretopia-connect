-- Group chat link on events
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS group_chat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_chat_room_id uuid REFERENCES public.spark_rooms(id) ON DELETE SET NULL;

-- Event context tag on connection requests (e.g. {"source":"event","event_id":"...","event_title":"..."})
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS context jsonb;

CREATE INDEX IF NOT EXISTS idx_creative_jams_group_chat_room ON public.creative_jams(group_chat_room_id) WHERE group_chat_room_id IS NOT NULL;

-- RLS: allow event host or any RSVP'd participant to read each other's basic profile via existing public_profiles_safe (no new policy needed).
-- Allow RSVP'd participants to read each other's jam_participants rows (already permitted by existing policies, no change).
