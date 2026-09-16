-- Fix the project invite trigger to route to /desk/{project_id} instead of /projects
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

-- Fix any existing broken project_invite notifications that point to /projects
UPDATE notifications
SET link = '/desk/' || (
    SELECT pc.project_id::text 
    FROM project_collaborators pc 
    WHERE pc.user_id = notifications.user_id 
    AND pc.created_at <= notifications.created_at + interval '5 seconds'
    AND pc.created_at >= notifications.created_at - interval '5 seconds'
    ORDER BY pc.created_at DESC 
    LIMIT 1
  ),
  action_url = '/desk/' || (
    SELECT pc.project_id::text 
    FROM project_collaborators pc 
    WHERE pc.user_id = notifications.user_id 
    AND pc.created_at <= notifications.created_at + interval '5 seconds'
    AND pc.created_at >= notifications.created_at - interval '5 seconds'
    ORDER BY pc.created_at DESC 
    LIMIT 1
  ),
  action_text = 'Open Project'
WHERE type = 'project_invite' 
  AND (link = '/projects' OR action_url = '/projects')
  AND EXISTS (
    SELECT 1 FROM project_collaborators pc 
    WHERE pc.user_id = notifications.user_id
    AND pc.created_at <= notifications.created_at + interval '5 seconds'
    AND pc.created_at >= notifications.created_at - interval '5 seconds'
  );