-- Host announcements in event chat
ALTER TABLE public.session_messages
  ADD COLUMN IF NOT EXISTS is_announcement boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_session_messages_announcements
  ON public.session_messages (session_id, is_announcement)
  WHERE is_announcement = true AND is_deleted = false;

-- Opt-in attendee visibility
ALTER TABLE public.jam_participants
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- Link an event to a Circle (group chat continuation) + control attendee list visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'creative_jams' AND column_name = 'circle_id'
  ) THEN
    -- circle_id may already exist from earlier work; guarded just in case
    ALTER TABLE public.creative_jams
      ADD COLUMN circle_id uuid REFERENCES public.spark_rooms(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS attendee_list_visibility text NOT NULL DEFAULT 'attendees';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creative_jams_attendee_list_visibility_check'
  ) THEN
    ALTER TABLE public.creative_jams
      ADD CONSTRAINT creative_jams_attendee_list_visibility_check
      CHECK (attendee_list_visibility IN ('host_only', 'attendees', 'public'));
  END IF;
END $$;