-- Critical gap flagged by the security scanner: "Users can grant themselves
-- fake 'accepted' connections to unlock other users' private profile data."
--
-- Root cause: both the INSERT and UPDATE policies on connections let the
-- request's own sender (auth.uid() = user_id) write ANY status value on
-- their own row, including 'accepted', with zero evidence the other party
-- ever consented:
--
--   "Users can create connections for matches" (INSERT)
--     WITH CHECK (auth.uid() = user_id OR <mutual swipe exists>)
--   "Users can update connections they're part of" (UPDATE)
--     USING (auth.uid() = user_id OR auth.uid() = connected_user_id)
--     -- no WITH CHECK at all, so it defaults to the same USING clause
--
-- Multiple policies on public.profiles ("Connected users view profiles",
-- "Users can view connected user profiles") grant full-row SELECT access
-- whenever ANY accepted connections row exists between the two users, in
-- either direction. So today: attacker inserts (or upserts, via
-- src/components/circle/ForYouFeed.tsx's match-flow onConflict path)
-- {user_id: attacker, connected_user_id: victim, status: 'accepted'} --
-- allowed unconditionally by the first branch of each policy above -- and
-- immediately reads the victim's full profile row. The victim never
-- consented; nothing checks that.
--
-- The legitimate paths that need to keep working:
--   1. src/components/connections/ConnectionRequestActions.tsx -- sender
--      inserts status:'pending', recipient (auth.uid() = connected_user_id)
--      later updates it to 'accepted'/'declined'. Sender never sets
--      accepted themselves here.
--   2. src/components/circle/ForYouFeed.tsx -- on a genuine mutual
--      right-swipe (verified against public.swipes), upserts BOTH
--      directions as 'accepted' in one go, so whichever user's swipe
--      triggers the match ends up as `user_id` on one of the two rows and
--      needs to set status:'accepted' on that row itself.
--
-- Fix: a sender may freely set/update their own row to 'pending' (or
-- withdraw it), but only ever reach 'accepted' when a real mutual
-- right-swipe exists for that exact pair -- the same evidence the match
-- flow already relies on. The recipient keeps unconditional authority to
-- accept/decline a request sent to them, since that response *is* the
-- consent.

-- ── INSERT ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create connections for matches" ON public.connections;
CREATE POLICY "Users can create connections for matches"
ON public.connections
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND (status IS NULL OR status = 'pending'))
  OR (
    EXISTS (
      SELECT 1 FROM public.swipes s1
      WHERE s1.user_id = auth.uid()
        AND s1.target_id = connections.user_id
        AND s1.direction = 'right'
    )
    AND EXISTS (
      SELECT 1 FROM public.swipes s2
      WHERE s2.user_id = connections.user_id
        AND s2.target_id = auth.uid()
        AND s2.direction = 'right'
    )
  )
);

-- ── UPDATE ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update connections they're part of" ON public.connections;
CREATE POLICY "Users can update connections they're part of"
ON public.connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = connected_user_id)
WITH CHECK (
  -- The recipient responding to a request sent to them is the consent
  -- itself -- no extra evidence needed.
  auth.uid() = connected_user_id
  OR (
    auth.uid() = user_id
    AND (
      status <> 'accepted'
      OR (
        EXISTS (
          SELECT 1 FROM public.swipes s1
          WHERE s1.user_id = connections.user_id
            AND s1.target_id = connections.connected_user_id
            AND s1.direction = 'right'
        )
        AND EXISTS (
          SELECT 1 FROM public.swipes s2
          WHERE s2.user_id = connections.connected_user_id
            AND s2.target_id = connections.user_id
            AND s2.direction = 'right'
        )
      )
    )
  )
);
