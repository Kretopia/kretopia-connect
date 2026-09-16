-- Create notifications table (updating existing if needed)
-- Add new columns to existing notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS action_text TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_matches BOOLEAN DEFAULT true,
  email_messages BOOLEAN DEFAULT true,
  email_projects BOOLEAN DEFAULT true,
  email_opportunities BOOLEAN DEFAULT true,
  push_matches BOOLEAN DEFAULT true,
  push_messages BOOLEAN DEFAULT true,
  push_projects BOOLEAN DEFAULT true,
  push_opportunities BOOLEAN DEFAULT true,
  in_app_all BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.notification_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_link TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_text TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_category TEXT DEFAULT 'general'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    action_url,
    action_text,
    image_url,
    priority,
    category
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_link,
    p_action_url,
    p_action_text,
    p_image_url,
    p_priority,
    p_category
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create notification preferences when profile is created
DROP TRIGGER IF EXISTS create_notification_prefs_on_profile ON public.profiles;
CREATE TRIGGER create_notification_prefs_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_notification_preferences();

-- Function to notify on new match
CREATE OR REPLACE FUNCTION public.notify_on_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
BEGIN
  -- Get user names
  SELECT full_name INTO user1_name FROM public.profiles WHERE user_id = NEW.user1_id;
  SELECT full_name INTO user2_name FROM public.profiles WHERE user_id = NEW.user2_id;
  
  -- Notify user1
  PERFORM public.create_notification(
    NEW.user1_id,
    'New Match! 🎉',
    'You matched with ' || user2_name,
    'match',
    '/circle',
    '/circle',
    'View Connection',
    NULL,
    'high',
    'match'
  );
  
  -- Notify user2
  PERFORM public.create_notification(
    NEW.user2_id,
    'New Match! 🎉',
    'You matched with ' || user1_name,
    'match',
    '/circle',
    '/circle',
    'View Connection',
    NULL,
    'high',
    'match'
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for match notifications
DROP TRIGGER IF EXISTS notify_match_trigger ON public.matches;
CREATE TRIGGER notify_match_trigger
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_match();

-- Function to notify on new message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Only notify if it's a user-to-user message (not support)
  IF NEW.receiver_id IS NOT NULL THEN
    SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
    
    PERFORM public.create_notification(
      NEW.receiver_id,
      'New Message',
      sender_name || ' sent you a message',
      'message',
      '/circle',
      '/circle',
      'View Message',
      NULL,
      'normal',
      'message'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for message notifications  
DROP TRIGGER IF EXISTS notify_message_trigger ON public.messages;
CREATE TRIGGER notify_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_message();

-- Trigger to update updated_at on notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);