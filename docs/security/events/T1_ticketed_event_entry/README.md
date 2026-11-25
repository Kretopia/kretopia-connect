# LOT T1: a paid event is entered with its ticket

**Status: prepared, rehearsed on a scratch Postgres 16, NOT applied to kretopia-app.** Run it in the SQL Editor of kretopia-app,
which can't be done while the Lovable credits are out; it needs no deployment and no new code file.

## The gap
Any signed-in member can put themselves on the guest list of an event that sells paid tickets, without paying:
- `rsvp_to_event` doesn't look at ticketing (`agent-rsvp-event` already says so and refuses ticketed events itself);
- the policy "Users can join jams" on `jam_participants` only checks `user_id = auth.uid()`;
- `can_join_event_online()` treats any `jam_participants` row as the right to join an online event.

## The rule
"Sells paid tickets" is the rule `sync_general_admission_tier()` already uses: `is_ticketed`, no external ticket link, and a price
above zero (or a paid tier). For those events a seat needs: the host, a co-host, or a **paid** order. Free events, external-ticket
events and ticketed-but-free events are unchanged.

## What it changes
`02_apply.sql` (one transaction, stops if anything is not as expected):
1. adds `event_sells_paid_tickets(uuid)` and `may_take_event_seat(uuid, uuid)` (read-only helpers, not callable by anon);
2. replaces `rsvp_to_event`: the 20260903020000 body plus one check; it answers `'ticket_required'`;
3. replaces the two own-row policies on `jam_participants` (join, and update to a seat-holding answer; cancel and decline stay open).

Not affected, because they bypass row-level security: ticket fulfilment (service role), waitlist promotion (SECURITY DEFINER).
Not changed: rows that already exist (`01_preflight.sql` counts them: `seated_without_paid_order_on_those_events`).

## Order
`01_preflight.sql` → `02_apply.sql` → `03_verify.sql` (all PASS). Rollback: `04_rollback.sql` (restores the previous function and
policies exactly; the weakness returns).

## Rehearsal (scratch Postgres, repository schema)
Before: a member without a ticket joins a paid event by RPC and by direct insert. After: both refused (`ticket_required`, RLS);
a paid buyer, the host and a co-host join; a pending order doesn't; free, external-ticket and ticketed-but-free events are
unchanged; a cancelled row can't move back to "going" without a ticket; a service-role insert still works; second apply stops;
rollback brings the old behaviour back.

## Known limits
- A member who already holds a seat without a paid order keeps it (and can't toggle their own visibility until they hold one).
- `can_join_event_online()` still trusts any participant row; with this lot, only entitled people get one going forward.
- Not run against production data: kretopia-app's actual policies could differ from the repository's migrations. The preflight and the
  apply's own checks stop in that case.
