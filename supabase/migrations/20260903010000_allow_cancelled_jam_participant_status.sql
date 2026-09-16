-- jam_participants.status has never allowed 'cancelled', even though three
-- separate pieces of code already assume it does:
--   - EventPage.tsx's handleJoin() cancel branch: .update({ status: 'cancelled' })
--   - rsvp_to_event()'s re-join check: WHERE status <> 'cancelled'
--   - promote_waitlist_on_cancel()'s trigger condition: NEW.status = 'cancelled'
-- Every attempt to cancel an RSVP via the primary "You're in" toggle button
-- has been failing with "violates check constraint jam_participants_status_check"
-- since the table was created, and the waitlist auto-promotion trigger's
-- UPDATE branch could never fire as a result (its DELETE branch still could).
-- Reproduced live: PATCH .../jam_participants {status:'cancelled'} -> 23514.
ALTER TABLE public.jam_participants
  DROP CONSTRAINT IF EXISTS jam_participants_status_check;

ALTER TABLE public.jam_participants
  ADD CONSTRAINT jam_participants_status_check
  CHECK (status IN ('interested', 'going', 'maybe', 'declined', 'cancelled'));
