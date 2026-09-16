CREATE OR REPLACE FUNCTION public.get_project_people(_project_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  role text,
  collaborator_status text,
  is_owner boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH project_row AS (
    SELECT p.id, p.created_by
    FROM public.projects p
    WHERE p.id = _project_id
      AND public.user_has_project_access(p.id, auth.uid())
  ), people AS (
    SELECT
      pr.created_by AS user_id,
      NULL::text AS collaborator_role,
      'accepted'::text AS collaborator_status,
      true AS is_owner,
      0 AS sort_order
    FROM project_row pr

    UNION ALL

    SELECT
      pc.user_id,
      pc.role AS collaborator_role,
      pc.status AS collaborator_status,
      false AS is_owner,
      CASE WHEN pc.status = 'accepted' THEN 1 ELSE 2 END AS sort_order
    FROM public.project_collaborators pc
    JOIN project_row pr ON pr.id = pc.project_id
    WHERE pc.user_id IS NOT NULL
      AND pc.status IN ('accepted', 'pending')
      AND pc.user_id <> pr.created_by
  )
  SELECT
    pe.user_id,
    COALESCE(NULLIF(p.full_name, ''), 'Member') AS full_name,
    p.avatar_url,
    COALESCE(NULLIF(pe.collaborator_role, ''), p.role) AS role,
    pe.collaborator_status,
    pe.is_owner
  FROM people pe
  JOIN public.profiles p ON p.user_id = pe.user_id
  WHERE COALESCE(p.is_hidden_backer, false) = false
  ORDER BY pe.sort_order, p.full_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_people(uuid) TO authenticated;