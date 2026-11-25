-- LOT T1 -- 03 VERIFY. Read-only. Proves the objects exist; the proof for people is below.
-- By hand, with a test member and a test event that sells a paid ticket: the RPC answers 'ticket_required'; after a paid order it
-- answers 'joined'; a free event is unchanged.
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM (
  SELECT 'helper: event_sells_paid_tickets' AS name, (to_regprocedure('public.event_sells_paid_tickets(uuid)') IS NOT NULL) AS ok
  UNION ALL SELECT 'helper: may_take_event_seat', (to_regprocedure('public.may_take_event_seat(uuid, uuid)') IS NOT NULL)
  UNION ALL SELECT 'rsvp_to_event asks may_take_event_seat', (SELECT prosrc LIKE '%may_take_event_seat%' AND prosrc LIKE '%ticket_required%' FROM pg_proc WHERE oid = to_regprocedure('public.rsvp_to_event(uuid, uuid, text)'))
  UNION ALL SELECT 'join policy asks may_take_event_seat', EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jam_participants' AND policyname = 'Users can join jams' AND with_check LIKE '%may_take_event_seat%')
  UNION ALL SELECT 'update policy keeps cancel and decline open', EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jam_participants' AND policyname = 'Users can update their own participation' AND with_check LIKE '%cancelled%' AND with_check LIKE '%may_take_event_seat%')
  UNION ALL SELECT 'helpers are not callable by anon', NOT has_function_privilege('anon', 'public.may_take_event_seat(uuid, uuid)', 'EXECUTE')
) c ORDER BY ok, name;
