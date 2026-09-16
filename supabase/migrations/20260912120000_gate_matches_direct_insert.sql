-- "Bible" item: matches auto-insertion (the same bug class as
-- connections' self-accept gap, already fixed in
-- 20260904090000_close_connection_self_accept_gap.sql, but never
-- propagated to matches).
--
-- public.matches' only INSERT policy since table creation
-- (20250930105322) is:
--   "System can create matches" WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id)
-- Any authenticated caller can name themselves as user1_id and an
-- arbitrary victim as user2_id, with zero evidence the victim ever
-- swiped, matched, or consented -- a forged match row (a) fires the
-- match-created trigger, sending the victim a false "It's a match!"
-- notification/email naming the attacker (a social-engineering/spam
-- vector), and (b) makes the attacker show up in the victim's
-- match/messages list (src/pages/messages/useConversations.ts reads
-- `matches` directly).
--
-- Three real call patterns write match_type='creator' rows today:
--   1. src/hooks/useSwipeActions.ts (the live swipe flow behind
--      src/pages/Match.tsx -> SwipeFeature) -- already verifies a real
--      mutual right-swipe via public.swipes before inserting. Its dead
--      legacy twins (src/components/circle/ForYouFeed.tsx,
--      useCircleData.ts, useDiscoverData.ts, ConnectFeed.tsx -- none
--      reachable from any route, confirmed via grep for importers) do
--      the same check.
--   2. src/lib/welcomeMatch.ts (checkAndCreateWelcomeMatch, called from
--      Onboarding.tsx) -- auto-connects every new user with the
--      platform founder/admin. No swipe evidence; legitimate by design.
--   3. src/pages/Auth.tsx (handleAutoConnect) and src/pages/Onboarding.tsx
--      (processPendingConnection) -- the QR-code auto-connect flow. No
--      swipe evidence either.
--
-- Fix: the raw table policy now only allows the swipe-verified case
-- directly (mirroring the connections fix's swipe-evidence subquery
-- exactly). The two non-swipe flows move behind a new RPC,
-- create_direct_match(), which is INTENTIONALLY no more permissive than
-- the connections table's existing create_bidirectional_connection()
-- RPC (also callable by any authenticated user for any target, already
-- shipped and load-bearing for these same two flows) -- this closes the
-- "reachable from literally any code path, not even RPC-wrapped" gap on
-- matches specifically without changing the QR-connect/welcome-match
-- trust model, which is a separate, larger, pre-existing question (see
-- the session summary for why that's flagged rather than redesigned
-- here).

DROP POLICY IF EXISTS "System can create matches" ON public.matches;

CREATE POLICY "Swipe-verified mutual matches"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (
  match_type = 'creator'
  AND (auth.uid() = user1_id OR auth.uid() = user2_id)
  AND EXISTS (
    SELECT 1 FROM public.swipes s1
    WHERE s1.user_id = matches.user1_id
      AND s1.target_id = matches.user2_id
      AND s1.target_type = 'profile'
      AND s1.direction = 'right'
  )
  AND EXISTS (
    SELECT 1 FROM public.swipes s2
    WHERE s2.user_id = matches.user2_id
      AND s2.target_id = matches.user1_id
      AND s2.target_type = 'profile'
      AND s2.direction = 'right'
  )
);

CREATE OR REPLACE FUNCTION public.create_direct_match(_other_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = _other_user_id THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  -- matches' UNIQUE(user1_id, user2_id, target_id) does not dedupe here
  -- (target_id is NULL for every match_type='creator' row, and Postgres
  -- never treats NULLs as equal for uniqueness) -- explicit existence
  -- check instead, matching the pattern already used by
  -- useSwipeActions.ts/ForYouFeed.tsx for the same reason.
  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE (user1_id = auth.uid() AND user2_id = _other_user_id)
       OR (user1_id = _other_user_id AND user2_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.matches (user1_id, user2_id, match_type, status)
  VALUES (auth.uid(), _other_user_id, 'creator', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_match(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_match(UUID) TO authenticated;
