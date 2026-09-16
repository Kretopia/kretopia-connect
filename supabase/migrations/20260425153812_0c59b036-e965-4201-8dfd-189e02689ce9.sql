CREATE OR REPLACE FUNCTION public.auto_generate_project_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when status transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN

    -- Owner credit (default role 'Creator' if none provided elsewhere)
    INSERT INTO public.project_credits (project_id, user_id, role, assigned_by, status)
    SELECT NEW.id, NEW.created_by, 'Creator', NEW.created_by, 'pending'
    WHERE NEW.created_by IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Collaborator credits (accepted only, with a user_id)
    INSERT INTO public.project_credits (project_id, user_id, role, assigned_by, status)
    SELECT 
      NEW.id,
      pc.user_id,
      COALESCE(NULLIF(pc.role, ''), 'Collaborator'),
      NEW.created_by,
      'pending'
    FROM public.project_collaborators pc
    WHERE pc.project_id = NEW.id
      AND pc.user_id IS NOT NULL
      AND COALESCE(pc.status, 'accepted') = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.project_credits ec
        WHERE ec.project_id = NEW.id AND ec.user_id = pc.user_id
      );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_generate_project_credits failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_project_credits ON public.projects;
CREATE TRIGGER trg_auto_generate_project_credits
AFTER UPDATE OF status ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_project_credits();

-- Backfill: generate pending credits for projects already completed but missing credits
INSERT INTO public.project_credits (project_id, user_id, role, assigned_by, status)
SELECT p.id, p.created_by, 'Creator', p.created_by, 'pending'
FROM public.projects p
WHERE p.status = 'completed'
  AND p.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_credits ec
    WHERE ec.project_id = p.id AND ec.user_id = p.created_by
  );

INSERT INTO public.project_credits (project_id, user_id, role, assigned_by, status)
SELECT p.id, pc.user_id, COALESCE(NULLIF(pc.role, ''), 'Collaborator'), p.created_by, 'pending'
FROM public.projects p
JOIN public.project_collaborators pc ON pc.project_id = p.id
WHERE p.status = 'completed'
  AND pc.user_id IS NOT NULL
  AND COALESCE(pc.status, 'accepted') = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_credits ec
    WHERE ec.project_id = p.id AND ec.user_id = pc.user_id
  );