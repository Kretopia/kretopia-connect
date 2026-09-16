
-- 1. Notify post owner when someone likes their post
CREATE OR REPLACE FUNCTION public.notify_on_feed_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  post_owner_id UUID;
  reactor_name TEXT;
  post_preview TEXT;
BEGIN
  -- Get post owner
  SELECT user_id, LEFT(COALESCE(content, auto_activity_message, 'your post'), 60)
  INTO post_owner_id, post_preview
  FROM feed_posts WHERE id = NEW.post_id;

  -- Don't notify yourself
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get reactor name
  SELECT full_name INTO reactor_name FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    post_owner_id,
    '🔥 ' || COALESCE(reactor_name, 'Someone') || ' liked your post',
    post_preview,
    'reaction',
    '/spark',
    '/spark',
    'View Post',
    NULL,
    'normal',
    'social'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_feed_reaction_trigger ON public.feed_reactions;
CREATE TRIGGER notify_feed_reaction_trigger
  AFTER INSERT ON public.feed_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_feed_reaction();

-- 2. Notify post owner when someone comments on their post
CREATE OR REPLACE FUNCTION public.notify_on_feed_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  post_owner_id UUID;
  commenter_name TEXT;
  comment_preview TEXT;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = NEW.post_id;

  -- Don't notify yourself
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO commenter_name FROM profiles WHERE user_id = NEW.user_id;
  comment_preview := LEFT(NEW.content, 80);

  PERFORM create_notification(
    post_owner_id,
    '💬 ' || COALESCE(commenter_name, 'Someone') || ' commented on your post',
    comment_preview,
    'comment',
    '/spark',
    '/spark',
    'View Comment',
    NULL,
    'normal',
    'social'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_feed_comment_trigger ON public.feed_comments;
CREATE TRIGGER notify_feed_comment_trigger
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_feed_comment();

-- 3. Notify room creator when someone posts in their room (avoid spam by only notifying creator)
CREATE OR REPLACE FUNCTION public.notify_on_room_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  room_creator_id UUID;
  room_name TEXT;
  sender_name TEXT;
  msg_preview TEXT;
BEGIN
  -- Get room info
  SELECT created_by, title INTO room_creator_id, room_name
  FROM spark_rooms WHERE id = NEW.room_id;

  -- Don't notify yourself
  IF room_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO sender_name FROM profiles WHERE user_id = NEW.user_id;
  msg_preview := LEFT(NEW.content, 80);

  PERFORM create_notification(
    room_creator_id,
    '🗨️ New message in ' || COALESCE(room_name, 'your room'),
    COALESCE(sender_name, 'Someone') || ': ' || msg_preview,
    'room_message',
    '/spark',
    '/spark',
    'View Room',
    NULL,
    'normal',
    'social'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_room_message_trigger ON public.spark_room_messages;
CREATE TRIGGER notify_room_message_trigger
  AFTER INSERT ON public.spark_room_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_room_message();

-- 4. Notify when someone sends a connection request
CREATE OR REPLACE FUNCTION public.notify_on_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requester_name TEXT;
BEGIN
  -- Only notify on pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO requester_name FROM profiles WHERE user_id = NEW.user_id;

  PERFORM create_notification(
    NEW.connected_user_id,
    '🤝 Connection Request',
    COALESCE(requester_name, 'Someone') || ' wants to connect with you',
    'connection',
    '/circle',
    '/circle',
    'View Request',
    NULL,
    'high',
    'connection'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_connection_request_trigger ON public.connections;
CREATE TRIGGER notify_connection_request_trigger
  AFTER INSERT ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_connection_request();

-- 5. Notify when someone is invited as a project collaborator
CREATE OR REPLACE FUNCTION public.notify_on_collaborator_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    '/projects',
    '/projects',
    'View Project',
    NULL,
    'high',
    'project'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_collaborator_invite_trigger ON public.project_collaborators;
CREATE TRIGGER notify_collaborator_invite_trigger
  AFTER INSERT ON public.project_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_collaborator_invite();
