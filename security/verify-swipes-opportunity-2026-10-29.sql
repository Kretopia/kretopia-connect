-- READ-ONLY. Paste into the SQL editor of the production database (kwmcocsitwssrtzkdojh) and run it. It changes nothing.
--
-- Why: the Match deck now shows offers found outside Kretopia between the people, and records a member's answer ("interested" /
-- "pass") as ONE row in public.swipes, written by the member's own session: target_type = 'opportunity', target_id = the listing's id.
-- The repo's first swipes migration allows 'profile' and 'opportunity', but a later migration declares a different list ('creator',
-- 'opportunity') and the table may have been altered by hand, so this checks what production really enforces, and that nothing reacts
-- to a swipe row (a trigger that notified someone would be wrong for an offer).
--
-- What to look for:
--   1. The CHECK on target_type must list 'opportunity'. If it does not, the deck still works (the card leaves the deck for the session,
--      the write fails quietly) but answers are not remembered: tell me and I will propose a migration instead.
--   2. The unique key should be (user_id, target_id, target_type), so answering the same offer twice is refused, not duplicated.
--   3. The policies should only let a member insert / read / delete THEIR OWN rows (user_id = auth.uid()), plus the "viewed by the
--      target" read, which can never match a listing id.
--   4. There should be NO trigger on swipes, or none that notifies, matches or connects people for a target_type other than 'profile'.
--   5. Today every row should be target_type 'profile'.

-- 1 + 2. constraints and keys
SELECT conname AS constraint_name, contype AS kind, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.swipes'::regclass
 ORDER BY contype, conname;

-- 3. row level security
SELECT polname AS policy, polcmd AS command, pg_get_expr(polqual, polrelid) AS using_expression, pg_get_expr(polwithcheck, polrelid) AS check_expression
  FROM pg_policy
 WHERE polrelid = 'public.swipes'::regclass
 ORDER BY polname;

-- 4. anything that reacts to a swipe row
SELECT tgname AS trigger, pg_get_triggerdef(oid) AS definition
  FROM pg_trigger
 WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal
 ORDER BY tgname;

-- 5. what is stored today (counts only, no member is identified)
SELECT target_type, direction, count(*) AS rows
  FROM public.swipes
 GROUP BY target_type, direction
 ORDER BY target_type, direction;
