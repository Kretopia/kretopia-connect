
-- 1. Columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS recap_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS recap_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recap_summary text;

-- Backfill tokens
UPDATE public.projects
SET recap_token = encode(gen_random_bytes(16), 'hex')
WHERE recap_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_recap_token ON public.projects(recap_token) WHERE recap_published = true;

-- Auto-assign token on insert
CREATE OR REPLACE FUNCTION public.assign_project_recap_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recap_token IS NULL THEN
    NEW.recap_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_project_recap_token ON public.projects;
CREATE TRIGGER trg_assign_project_recap_token
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_project_recap_token();

-- 2. Public read policy (only when published)
DROP POLICY IF EXISTS "Anyone can view published recaps" ON public.projects;
CREATE POLICY "Anyone can view published recaps"
ON public.projects
FOR SELECT
TO anon, authenticated
USING (recap_published = true);

GRANT SELECT ON public.projects TO anon;

-- 3. RPC: bundle recap data
CREATE OR REPLACE FUNCTION public.get_public_studio_recap(token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj public.projects%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO proj
  FROM public.projects
  WHERE recap_token = token AND recap_published = true
  LIMIT 1;

  IF proj.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'project', jsonb_build_object(
      'id', proj.id,
      'title', proj.title,
      'description', proj.description,
      'cover_url', proj.cover_url,
      'mood', proj.mood,
      'workspace_type', proj.workspace_type,
      'status', proj.status,
      'client_name', proj.client_name,
      'deadline', proj.deadline,
      'created_at', proj.created_at,
      'updated_at', proj.updated_at,
      'recap_summary', proj.recap_summary
    ),
    'owner', (
      SELECT jsonb_build_object(
        'user_id', p.user_id,
        'full_name', p.full_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'headline', p.headline
      )
      FROM public.profiles p
      WHERE p.user_id = proj.created_by
      LIMIT 1
    ),
    'collaborators', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.user_id,
        'full_name', p.full_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'headline', p.headline,
        'role', pc.role
      ))
      FROM public.project_collaborators pc
      JOIN public.profiles p ON p.user_id = pc.user_id
      WHERE pc.project_id = proj.id AND pc.status = 'accepted'
    ), '[]'::jsonb),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'description', m.description,
        'status', m.status,
        'due_date', m.due_date,
        'completed_at', m.completed_at
      ) ORDER BY m.created_at)
      FROM public.project_milestones m
      WHERE m.project_id = proj.id
    ), '[]'::jsonb),
    'deliverables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'description', d.description,
        'status', d.status,
        'moodboard', d.moodboard,
        'completed_at', d.updated_at
      ))
      FROM public.project_deliverables d
      WHERE d.project_id = proj.id AND d.status IN ('approved', 'final', 'completed')
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_studio_recap(text) TO anon, authenticated;
