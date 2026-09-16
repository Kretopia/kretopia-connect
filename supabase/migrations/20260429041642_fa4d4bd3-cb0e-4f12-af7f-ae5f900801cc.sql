-- Trigger: notify project collaborators (except uploader) when moodboard items are added
CREATE OR REPLACE FUNCTION public.notify_moodboard_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_count int := 0;
  new_count int := 0;
  uploader uuid;
  project_title text;
  project_owner uuid;
  collab_user uuid;
BEGIN
  old_count := COALESCE(jsonb_array_length(OLD.moodboard), 0);
  new_count := COALESCE(jsonb_array_length(NEW.moodboard), 0);

  IF new_count <= old_count THEN
    RETURN NEW;
  END IF;

  -- Best-guess uploader = current auth user (RLS context)
  uploader := auth.uid();

  SELECT title, created_by INTO project_title, project_owner
  FROM public.projects WHERE id = NEW.project_id;

  -- Notify project owner (if not uploader)
  IF project_owner IS NOT NULL AND project_owner <> uploader THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url, action_text, category, priority)
    VALUES (
      project_owner,
      'moodboard_added',
      'New moodboard reference',
      COALESCE(NEW.title, 'A deliverable') || ' has new visual references in ' || COALESCE(project_title, 'your project'),
      '/desk/' || NEW.project_id::text,
      'View board',
      'project',
      'normal'
    );
  END IF;

  -- Notify all accepted collaborators (excluding uploader & owner)
  FOR collab_user IN
    SELECT user_id FROM public.project_collaborators
    WHERE project_id = NEW.project_id
      AND status = 'accepted'
      AND user_id IS NOT NULL
      AND user_id <> COALESCE(uploader, '00000000-0000-0000-0000-000000000000'::uuid)
      AND user_id <> COALESCE(project_owner, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url, action_text, category, priority)
    VALUES (
      collab_user,
      'moodboard_added',
      'New moodboard reference',
      COALESCE(NEW.title, 'A deliverable') || ' has new visual references in ' || COALESCE(project_title, 'your project'),
      '/desk/' || NEW.project_id::text,
      'View board',
      'project',
      'normal'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_moodboard_added ON public.project_deliverables;
CREATE TRIGGER trg_notify_moodboard_added
AFTER UPDATE OF moodboard ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.notify_moodboard_added();