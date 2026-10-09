-- ============================================================================
-- Studio access: an invitation is not membership (audit 2026-10-09).
-- No new table, no new column, no data change. Idempotent.
-- APPLY SEPARATELY from the two earlier 20261009 migrations and smoke-test with
-- two accounts first (owner + invited user): it changes who can read a Studio.
--
-- PROBLEM (verified on production, 16 pending invitees across 9 projects)
--   user_has_project_access() counts status 'pending' collaborators, and that
--   one function gates projects (read AND update), project_deliverables,
--   deliverable_versions/comments, creative_assets, asset_versions, guest
--   tokens and the project-files storage bucket (read, upload, update,
--   DELETE). So someone who has merely been *invited*, and never accepted,
--   can read the whole Studio, edit it and delete its files. The edge-function
--   guard (_shared/projectAccess.ts) already documents this and requires
--   'accepted'; the database did not.
--   Separately, the accept-your-own-invitation UPDATE policy did not freeze
--   `role`, so an invitee could write role = 'owner' while accepting, and the
--   invite INSERT policy let any accepted member add rows with any status/role.
--
-- WHAT THIS DOES
--   1. user_has_project_access(): owner / match member / ACCEPTED collaborator.
--   2. A pending invitee still gets what the accept banner needs, nothing
--      more: the project row (policy on projects) and their own collaborator
--      row (policy on project_collaborators), through has_pending_project_invite().
--   3. Non-owner members may only add PENDING invitations attributed to
--      themselves and may not hand out owner/manager/admin roles.
--   4. A trigger stops an invitee from changing anything but pending ->
--      accepted/rejected on their own row (role, project, invited_by frozen).
--
-- NOT IN THIS MIGRATION (needs a product decision: role matrix)
--   accepted 'guest' / 'client' members can still write deliverables/files;
--   RLS does not read project_collaborators.role except for milestone money.
--
-- ROLLBACK: security/rollback-2026-10-09.sql
-- ============================================================================

-- 1. Membership = accepted (or owner / match member).
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- User created the project (solo projects)
    SELECT 1 FROM projects p
    WHERE p.id = project_id_param
      AND p.created_by = user_id_param
      AND p.match_id IS NULL
  )
  OR EXISTS (
    -- User is part of the match
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_id_param
      AND (m.user1_id = user_id_param OR m.user2_id = user_id_param)
  )
  OR EXISTS (
    -- User accepted the invitation. 'pending' is NOT access.
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_id_param
      AND pc.user_id = user_id_param
      AND pc.status = 'accepted'
  );
$$;

-- 2. What a pending invitee may see (the accept banner), and only that.
CREATE OR REPLACE FUNCTION public.has_pending_project_invite(project_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_id_param
      AND pc.user_id = user_id_param
      AND pc.status = 'pending'
  );
$$;

REVOKE ALL ON FUNCTION public.has_pending_project_invite(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_pending_project_invite(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR public.user_has_project_access(id, auth.uid())
  OR public.has_pending_project_invite(id, auth.uid())
);

DROP POLICY IF EXISTS "Users can view project collaborators" ON public.project_collaborators;
CREATE POLICY "Users can view project collaborators"
ON public.project_collaborators
FOR SELECT
USING (
  public.user_has_project_access(project_id, auth.uid())
  OR user_id = auth.uid()
);

-- 3. Inviting: the owner is unrestricted; any other accepted member may only
--    add a PENDING invitation in their own name, never an owner/manager/admin.
DROP POLICY IF EXISTS "Project members can invite collaborators" ON public.project_collaborators;
CREATE POLICY "Project members can invite collaborators"
ON public.project_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_collaborators.project_id AND p.created_by = auth.uid()
  )
  OR (
    status = 'pending'
    AND invited_by = auth.uid()
    AND lower(coalesce(role, 'member')) NOT IN ('owner', 'manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'accepted'
    )
  )
);

-- 4. An invitee answering their own invitation can change only the answer.
CREATE OR REPLACE FUNCTION public.guard_project_collaborator_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Server contexts (service_role, cron, auth hooks) are trusted.
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- The owner manages the roster freely.
  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = OLD.project_id AND p.created_by = v_uid) THEN
    RETURN NEW;
  END IF;
  -- Only the invitee's own row is reachable here (RLS), freeze everything but the answer.
  IF OLD.user_id IS NOT DISTINCT FROM v_uid THEN
    NEW.project_id := OLD.project_id;
    NEW.user_id := OLD.user_id;
    NEW.email := OLD.email;
    NEW.role := OLD.role;
    NEW.agent_role := OLD.agent_role;
    NEW.invited_by := OLD.invited_by;
    NEW.invited_at := OLD.invited_at;
    IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected') THEN
      IF NEW.status = 'accepted' THEN
        NEW.accepted_at := coalesce(NEW.accepted_at, now());
      END IF;
    ELSE
      NEW.status := OLD.status;
      NEW.accepted_at := OLD.accepted_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_collaborator_self_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_project_collaborator_self_update() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_project_collaborator_self_update ON public.project_collaborators;
CREATE TRIGGER trg_guard_project_collaborator_self_update
BEFORE UPDATE ON public.project_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.guard_project_collaborator_self_update();

NOTIFY pgrst, 'reload schema';
