-- Confirmed gap found while auditing this session's own money-RLS work:
-- "Project members can invite collaborators" (20260505123546) lets any
-- accepted collaborator insert a new project_collaborators row, but never
-- restricts which `role` value they may assign. can_see_milestone_money()
-- (20260825100000) treats role IN ('member','creative') as money-visible
-- and ('client','guest') as explicitly not -- by design, per the Feature
-- Bible's documented "Client: NO money" / "Guest: no money" intent.
--
-- Net effect: a 'client' or 'guest' collaborator -- who is themselves
-- denied money visibility -- can still invite a brand-new collaborator
-- with role='member' or role='creative', handing that third party money
-- visibility the inviter was never trusted with. A trusted collaborator
-- ('member'/'creative') or the project owner inviting a peer is
-- unaffected; only a client/guest attempting to assign a money-visible
-- role to someone else is blocked.

DROP POLICY IF EXISTS "Project members can invite collaborators" ON public.project_collaborators;

CREATE POLICY "Project members can invite collaborators"
ON public.project_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  -- The inviter must be the project owner OR an accepted member of the
  -- project (unchanged from the prior policy)...
  (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_collaborators.project_id
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'accepted'
    )
  )
  -- ...AND a non-owner inviter with a non-money-visible role of their own
  -- ('client'/'guest') may only assign that same tier of role to the
  -- invitee, never escalate them to a money-visible one.
  AND (
    project_collaborators.role IN ('client', 'guest')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_collaborators.project_id
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'accepted'
        AND pc.role IN ('member', 'creative')
    )
  )
);
