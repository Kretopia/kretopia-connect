-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    -- User is an accepted collaborator
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_id_param
    AND pc.user_id = user_id_param
    AND pc.status = 'accepted'
  );
$$;

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their solo projects" ON projects;
DROP POLICY IF EXISTS "Users can view their matched projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they collaborate on" ON projects;
DROP POLICY IF EXISTS "Users can update their solo projects" ON projects;
DROP POLICY IF EXISTS "Users can update their matched projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects they collaborate on" ON projects;

-- Create simple policies using the security definer function
CREATE POLICY "Users can view accessible projects"
  ON projects FOR SELECT
  USING (user_has_project_access(id, auth.uid()));

CREATE POLICY "Users can update accessible projects"
  ON projects FOR UPDATE
  USING (user_has_project_access(id, auth.uid()));