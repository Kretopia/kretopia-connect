-- A member's own calendar of events, kept apart from attendance.
--
-- PREPARED FOR REVIEW, NOT APPLIED. Production still runs the legacy backend, which cannot receive migrations from this repo.
--
-- Why: "Add to my Kretopia calendar" used to mean "RSVP": the only events that could appear on a member's calendar were the ones they
-- were going to (jam_participants.status = 'going'). Saving an event to a calendar is not an RSVP, a ticket or a reservation, so it
-- must not create attendance, change a participant count, or show up in the host's guest list. This table is the member's own list:
--   * written and read by its owner only (policies below); a host never sees who put their event on a calendar;
--   * never read by the RSVP, waitlist, ticket or count code (rsvp_to_event, cancel_event_rsvp and the counts stay as they are);
--   * removed with the event (ON DELETE CASCADE) and with the member.
--
-- Until it is applied the app says so plainly ("Saving to your Kretopia calendar isn't available yet") and still offers the
-- external calendar export; nothing else depends on this table.
--
-- Preflight (read-only):
--   SELECT to_regclass('public.event_calendar_entries');  -- NULL until applied
--
-- Rollback: DROP TABLE public.event_calendar_entries;  (no other object references it; RSVPs are untouched)

CREATE TABLE IF NOT EXISTS public.event_calendar_entries (
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- The cascade from creative_jams looks rows up by event.
CREATE INDEX IF NOT EXISTS event_calendar_entries_event_idx ON public.event_calendar_entries (event_id);

ALTER TABLE public.event_calendar_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read their own calendar entries" ON public.event_calendar_entries;
CREATE POLICY "Members read their own calendar entries"
  ON public.event_calendar_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only an event the member could see anyway can be put on their calendar.
DROP POLICY IF EXISTS "Members add visible events to their own calendar" ON public.event_calendar_entries;
CREATE POLICY "Members add visible events to their own calendar"
  ON public.event_calendar_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.creative_jams j
      WHERE j.id = event_id
        AND ((j.is_public = true AND j.claim_status = 'claimed') OR j.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members remove their own calendar entries" ON public.event_calendar_entries;
CREATE POLICY "Members remove their own calendar entries"
  ON public.event_calendar_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.event_calendar_entries TO authenticated;
