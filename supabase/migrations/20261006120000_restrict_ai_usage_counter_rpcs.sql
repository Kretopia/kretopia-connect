-- Restrict the AI usage-counter RPCs to the service role.
--
-- WRITTEN FOR REVIEW. NOT APPLIED TO THE LIVE DATABASE. Per the standing rule
-- for this repo, database changes need explicit human approval before they are
-- applied (via the SQL editor of the backend the app really uses). Merging this
-- file does not apply it.
--
-- Problem (confirmed on production 2026-10-06 with the public anon key):
--   public.consume_copilot_message(_user_id uuid, _daily_cap integer) is a
--   SECURITY DEFINER function that increments a per-user daily counter for ANY
--   `_user_id` it is given, and it was executable by the `anon` role. Anyone
--   holding the public site key could therefore use up another user's daily
--   Kreto / DeskAI allowance, knowing only that user's id. (The probe wrote one
--   counter row, for the nil UUID 00000000-0000-0000-0000-000000000000.)
--
--   Why the earlier grants did not prevent it: 20260502231733 only ADDS
--   `GRANT EXECUTE ... TO authenticated, service_role`. A function is also
--   executable by PUBLIC by default, and Supabase's default privileges grant
--   EXECUTE on new public functions to anon / authenticated / service_role, so
--   `anon` kept access. The same applies to the sibling counters:
--     - consume_studio_ai_generation(uuid, integer)   (20260819090000)
--     - refund_studio_ai_generation(uuid, date)       (20260819090000) -- meant
--       for service_role only, but also callable by anyone; calling it
--       repeatedly resets a user's count, i.e. lifts their own daily cap.
--
-- Fix: every real caller is an edge function using the SERVICE ROLE client
-- (thrive-ai-chat, desk-ai, desk-agent, _shared/studioAIGate.ts used by
-- generate-studio-image / generate-studio-copy); nothing in src/ calls them.
-- So the three functions are made executable by service_role only. This also
-- closes the "signed-in user burns someone else's quota" variant, because the
-- `authenticated` role loses access too, independently of whether the
-- caller-identity check from 20260910180000 has been applied.
--
-- Safe to run anywhere: a function that does not exist in the target database
-- is skipped, the statements are idempotent, and no function body, table, row,
-- policy or column is touched. consume_ai_feature_call is not listed on purpose:
-- it already revokes public/anon in 20260910160000 and is not in production.
--
-- Effect on the app: none expected for server code (service_role keeps EXECUTE).
-- Any client that called these RPCs directly with a user session would now get
-- "permission denied for function" -- none exists in this repository.
--
-- Verify after applying (all four should be false, true for service_role):
--   SELECT has_function_privilege('anon',          'public.consume_copilot_message(uuid,integer)', 'EXECUTE');
--   SELECT has_function_privilege('authenticated', 'public.consume_copilot_message(uuid,integer)', 'EXECUTE');
--   SELECT has_function_privilege('service_role',  'public.consume_copilot_message(uuid,integer)', 'EXECUTE');
--
-- Roll back (restores the grants 20260502231733 / 20260819090000 intended):
--   GRANT EXECUTE ON FUNCTION public.consume_copilot_message(uuid, integer)       TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.consume_studio_ai_generation(uuid, integer)  TO authenticated;
-- (refund_studio_ai_generation was only ever meant for service_role.)

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.consume_copilot_message(uuid, integer)',
    'public.consume_studio_ai_generation(uuid, integer)',
    'public.refund_studio_ai_generation(uuid, date)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END
$$;
