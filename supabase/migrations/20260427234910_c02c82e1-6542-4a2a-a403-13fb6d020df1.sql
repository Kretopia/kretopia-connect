-- Allow pending invitees to read the project (so the accept banner can show)
-- instead of hitting a "Workspace not found" wall.
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- User is a collaborator (accepted OR pending — pending users need to
    -- load the workspace shell so the accept banner can render)
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_id_param
    AND pc.user_id = user_id_param
    AND pc.status IN ('accepted', 'pending')
  );
$function$;