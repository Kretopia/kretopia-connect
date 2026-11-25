-- LOT T1 -- a paid event is entered with its ticket -- 01 PREFLIGHT. Read-only. SQL Editor of "kretopia-app" only.
--
-- Today any signed-in member can put themselves on the guest list of an event that sells paid tickets, without paying:
--   * rsvp_to_event(event, ...) does not look at ticketing (agent-rsvp-event already says so and refuses ticketed events itself);
--   * the policy "Users can join jams" on jam_participants only checks user_id = auth.uid();
--   * can_join_event_online() treats any jam_participants row as the right to join an online event.
-- 02_apply.sql closes both doors for "native paid" events (the same rule sync_general_admission_tier() already uses: is_ticketed,
-- price above zero, no external ticket link, or a paid tier). The host, a co-host and a buyer with a paid order always pass.
-- It does not touch rows that already exist. The last three findings below count them, for a decision by hand.
SELECT 'rsvp_to_event_exists' AS finding, (to_regprocedure('public.rsvp_to_event(uuid, uuid, text)') IS NOT NULL)::text AS detail
UNION ALL
SELECT 'rsvp_to_event_is_the_version_this_lot_replaces',
       coalesce((SELECT (prosrc LIKE '%event_rsvp%' AND prosrc NOT LIKE '%may_take_event_seat%')::text
                 FROM pg_proc WHERE oid = to_regprocedure('public.rsvp_to_event(uuid, uuid, text)')), 'MISSING')
UNION ALL
SELECT 'join_policy_present', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jam_participants' AND policyname = 'Users can join jams')::text
UNION ALL
SELECT 'update_policy_present', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jam_participants' AND policyname = 'Users can update their own participation')::text
UNION ALL
SELECT 'co_hosts_table', (to_regclass('public.event_co_hosts') IS NOT NULL)::text
UNION ALL
SELECT 'ticket_tiers_table', (to_regclass('public.event_ticket_tiers') IS NOT NULL)::text
UNION ALL
SELECT 'native_paid_events', count(*)::text FROM public.creative_jams j
 WHERE coalesce(j.is_ticketed, false) AND coalesce(j.external_ticket_url, '') = '' AND coalesce(j.ticket_price, 0) > 0
UNION ALL
SELECT 'seated_without_paid_order_on_those_events', count(*)::text FROM public.jam_participants p JOIN public.creative_jams j ON j.id = p.jam_id
 WHERE coalesce(j.is_ticketed, false) AND coalesce(j.external_ticket_url, '') = '' AND coalesce(j.ticket_price, 0) > 0
   AND p.user_id IS NOT NULL AND p.status <> 'cancelled' AND p.user_id <> j.created_by
   AND NOT EXISTS (SELECT 1 FROM public.event_orders o WHERE o.event_id = j.id AND o.buyer_id = p.user_id AND o.status = 'paid')
UNION ALL
SELECT 'rows_with_status_rsvp_(should_be_0)', count(*)::text FROM public.jam_participants WHERE status = 'rsvp';
