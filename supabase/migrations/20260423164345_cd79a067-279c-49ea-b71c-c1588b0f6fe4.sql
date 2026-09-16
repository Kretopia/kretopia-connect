
CREATE OR REPLACE FUNCTION public.notify_project_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_sender_name TEXT;
  v_recipient UUID;
  v_preview TEXT;
  v_is_mentioned BOOLEAN;
  v_title TEXT;
  v_link TEXT;
BEGIN
  -- Get project info
  SELECT id, title, created_by INTO v_project
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_project.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'Someone';
  END IF;

  -- Build preview
  v_preview := COALESCE(NEW.message, '');
  IF length(v_preview) > 80 THEN
    v_preview := substring(v_preview from 1 for 80) || '...';
  END IF;

  v_link := '/desk/' || NEW.project_id::text || '?tab=messages';

  -- Build a distinct list of recipients (owner + collaborators), excluding the sender
  FOR v_recipient IN
    SELECT DISTINCT uid FROM (
      SELECT v_project.created_by AS uid
      UNION
      SELECT user_id AS uid
      FROM public.project_collaborators
      WHERE project_id = NEW.project_id
        AND COALESCE(status, 'accepted') = 'accepted'
    ) s
    WHERE s.uid IS NOT NULL AND s.uid <> NEW.user_id
  LOOP
    -- Detect @mention by full_name in message body
    v_is_mentioned := FALSE;
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_recipient
        AND p.full_name IS NOT NULL
        AND NEW.message ILIKE '%@' || p.full_name || '%'
    ) INTO v_is_mentioned;

    IF v_is_mentioned THEN
      v_title := v_sender_name || ' mentioned you in ' || COALESCE(v_project.title, 'a project');
    ELSE
      v_title := 'New message in ' || COALESCE(v_project.title, 'a project');
    END IF;

    INSERT INTO public.notifications (
      user_id, title, message, type, link, action_url, action_text,
      priority, category
    ) VALUES (
      v_recipient,
      v_title,
      v_sender_name || ': ' || v_preview,
      'message',
      v_link,
      v_link,
      'View Message',
      CASE WHEN v_is_mentioned THEN 'high' ELSE 'normal' END,
      'message'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the message insert if notification creation fails
  RAISE WARNING 'notify_project_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_message ON public.project_messages;

CREATE TRIGGER trg_notify_project_message
AFTER INSERT ON public.project_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_project_message();
