-- LOT A1 -- the "credit confirmed" notification opens that credit -- 01 PREFLIGHT. Read-only. SQL Editor of "kretopia-app" only.
--
-- Today notify_credit_owner_on_endorsement() (trigger trg_notify_credit_owner_on_endorsement on credit_endorsements) tells the owner
-- "<name> verified your work on <project>" and links to /profile?tab=credits, a tab the Passport no longer has, so the owner lands on
-- a generic page. 02_apply.sql changes only the wording ("confirmed", which is what an authenticated co-sign is; it is not an
-- independent verification) and the link (/credits?credit=<id>, which opens on that credit). Same trigger, same condition, one row
-- per pending -> accepted change (the submit RPC refuses a second answer).
SELECT 'function_exists' AS finding, (to_regprocedure('public.notify_credit_owner_on_endorsement()') IS NOT NULL)::text AS detail
UNION ALL
SELECT 'trigger_enabled', coalesce((SELECT tgenabled::text FROM pg_trigger WHERE tgname = 'trg_notify_credit_owner_on_endorsement'), 'MISSING')
UNION ALL
SELECT 'source_is_the_one_this_lot_replaces',
       (SELECT (prosrc LIKE '%/profile?tab=credits%' AND prosrc LIKE '%credit_cosigned%')::text FROM pg_proc WHERE oid = 'public.notify_credit_owner_on_endorsement()'::regprocedure)
UNION ALL
SELECT 'credit_cosigned_rows_last_30_days', count(*)::text FROM public.notifications WHERE type = 'credit_cosigned' AND created_at > now() - interval '30 days';
