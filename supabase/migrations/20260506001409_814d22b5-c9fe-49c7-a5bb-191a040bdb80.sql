CREATE OR REPLACE FUNCTION public.notify_on_collaborator_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inviter_name TEXT;
  project_name TEXT;
BEGIN
  -- Skip email-only invites (no platform user yet)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO inviter_name FROM profiles WHERE user_id = NEW.invited_by;
  SELECT title INTO project_name FROM projects WHERE id = NEW.project_id;

  PERFORM create_notification(
    NEW.user_id,
    '📋 Project Invitation',
    COALESCE(inviter_name, 'Someone') || ' invited you to ' || COALESCE(project_name, 'a project'),
    'project_invite',
    '/desk/' || NEW.project_id::text,
    '/desk/' || NEW.project_id::text,
    'Open Project',
    NULL,
    'high',
    'project'
  );

  RETURN NEW;
END;
$function$;