ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'irl',
  ADD COLUMN IF NOT EXISTS online_format text,
  ADD COLUMN IF NOT EXISTS online_max_attendees integer,
  ADD COLUMN IF NOT EXISTS watch_party_video_url text,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_room_url text,
  ADD COLUMN IF NOT EXISTS video_room_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_room_started_by uuid;

ALTER TABLE public.creative_jams DROP CONSTRAINT IF EXISTS creative_jams_event_mode_check;
ALTER TABLE public.creative_jams
  ADD CONSTRAINT creative_jams_event_mode_check
  CHECK (event_mode IN ('irl','online','hybrid'));

ALTER TABLE public.creative_jams DROP CONSTRAINT IF EXISTS creative_jams_online_format_check;
ALTER TABLE public.creative_jams
  ADD CONSTRAINT creative_jams_online_format_check
  CHECK (online_format IS NULL OR online_format IN ('group_room','stage','watch_party','podcast'));

CREATE OR REPLACE FUNCTION public.can_join_event_online(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creative_jams j
    WHERE j.id = _event_id
      AND (
        j.created_by = _user_id
        OR EXISTS (
          SELECT 1 FROM public.event_co_hosts ch
          WHERE ch.event_id = j.id AND ch.user_id = _user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.jam_participants p
          WHERE p.jam_id = j.id AND p.user_id = _user_id
        )
        OR (
          j.is_ticketed = true
          AND EXISTS (
            SELECT 1 FROM public.event_orders o
            WHERE o.event_id = j.id
              AND o.buyer_id = _user_id
              AND o.status = 'paid'
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_join_event_online(uuid, uuid) TO authenticated;