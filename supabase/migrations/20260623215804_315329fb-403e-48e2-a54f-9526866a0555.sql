
-- ===== 1. agent_runs: lock down anon read/write =====
DROP POLICY IF EXISTS "agent_runs anyone insert" ON public.agent_runs;
DROP POLICY IF EXISTS "agent_runs public read" ON public.agent_runs;

CREATE POLICY "agent_runs owners read"
  ON public.agent_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts/updates remain service_role only via the existing "agent_runs service all" policy.

-- ===== 2. opportunities: hide guest_email from public reads =====
-- The "Public can view active opportunities" policy stays (USING status='active'),
-- but column-level grants prevent guest_email leaking. Owners read via separate policies
-- (already in place) which retain SELECT on guest_email through the table grant for owners.
REVOKE SELECT (guest_email) ON public.opportunities FROM anon, authenticated;

-- ===== 3. profiles: drop overly broad "view opportunity creator profiles" =====
-- Callers should use the public_profiles_safe view (already the documented pattern).
DROP POLICY IF EXISTS "Users can view opportunity creator profiles" ON public.profiles;

-- ===== 4. Lock search_path on the 6 SECURITY DEFINER functions missing it =====
ALTER FUNCTION public.enqueue_email(text, jsonb)               SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.delete_email(text, bigint)               SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.update_entry_vote_count()                SET search_path = public;
ALTER FUNCTION public.update_challenge_entry_count()           SET search_path = public;
