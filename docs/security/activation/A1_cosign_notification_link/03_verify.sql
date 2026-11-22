-- LOT A1 -- 03 VERIFY. Read-only. Proves the function body and trigger; the proof for people is the next real confirmation: the
-- owner's notification reads "... confirmed your credit on ..." and opens /credits on that credit.
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM (
  SELECT 'links to the exact credit' AS name, (SELECT prosrc LIKE '%/credits?credit=%' FROM pg_proc WHERE oid = 'public.notify_credit_owner_on_endorsement()'::regprocedure) AS ok
  UNION ALL SELECT 'says confirmed, not verified', (SELECT prosrc LIKE '%confirmed your credit%' AND prosrc NOT LIKE '%verified your work%' FROM pg_proc WHERE oid = 'public.notify_credit_owner_on_endorsement()'::regprocedure)
  UNION ALL SELECT 'trigger still enabled', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_credit_owner_on_endorsement' AND tgenabled <> 'D')
) c ORDER BY ok, name;
