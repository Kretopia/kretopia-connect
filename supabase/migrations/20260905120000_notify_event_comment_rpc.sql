-- Deadline-day P0 fix: event comment notifications are silently dropped.
--
-- EventComments.tsx calls sendPushNotification() for the event host and
-- every other commenter on the thread when a new comment is posted. That
-- helper's in-app leg does `supabase.from('notifications').insert({user_id:
-- <someone else>, ...})` directly from the client — but the notifications
-- INSERT policy only allows auth.uid() = user_id OR admin
-- (20260327223242), so every cross-user insert is rejected by RLS and only
-- console.error'd. The browser-push leg still fires (send-push-notification
-- has its own "shared event" relationship check), so users only ever see a
-- push notification, never the in-app bell entry.
--
-- Same root cause and same fix already applied for the equivalent
-- hire-loop notification gaps (20260824000000_hire_loop_notification_
-- supplement.sql): a SECURITY DEFINER RPC that re-derives the recipients
-- server-side instead of trusting a client-supplied user_id, using the
-- existing notifications.dedupe_key unique index for idempotency.

CREATE OR REPLACE FUNCTION public.notify_event_comment(_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _comment RECORD;
  _event RECORD;
  _commenter_name text;
  _preview text;
  _recipient RECORD;
BEGIN
  SELECT * INTO _comment FROM public.event_comments WHERE id = _comment_id;
  IF _comment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'comment_not_found');
  END IF;

  -- Only the comment's own author can trigger notifications for it.
  IF auth.uid() IS NULL OR auth.uid() <> _comment.user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT * INTO _event FROM public.creative_jams WHERE id = _comment.event_id;
  IF _event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;

  SELECT full_name INTO _commenter_name FROM public.profiles WHERE user_id = _comment.user_id;
  _preview := CASE
    WHEN _comment.content IS NOT NULL AND length(_comment.content) > 0
      THEN left(_comment.content, 80)
    ELSE '📷 Shared a photo'
  END;

  -- Notify the host, unless they're the one commenting.
  IF _event.created_by IS NOT NULL AND _event.created_by <> _comment.user_id THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, link, action_url, action_text, priority, category, dedupe_key
    )
    VALUES (
      _event.created_by,
      'general',
      'New comment on ' || _event.title,
      COALESCE(_commenter_name, 'Someone') || ': ' || _preview,
      '/event/' || _event.id::text,
      '/event/' || _event.id::text,
      'View',
      'normal',
      'general',
      'event-comment:' || _comment.id::text || ':' || _event.created_by::text
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;

  -- Notify every other distinct commenter already on this event's thread
  -- (matches the client's prior, RLS-blocked intent exactly), excluding the
  -- author and the host (already notified above).
  FOR _recipient IN
    SELECT DISTINCT ec.user_id
    FROM public.event_comments ec
    WHERE ec.event_id = _comment.event_id
      AND ec.user_id <> _comment.user_id
      AND ec.user_id IS DISTINCT FROM _event.created_by
  LOOP
    INSERT INTO public.notifications (
      user_id, type, title, message, link, action_url, action_text, priority, category, dedupe_key
    )
    VALUES (
      _recipient.user_id,
      'general',
      'New comment on ' || _event.title,
      COALESCE(_commenter_name, 'Someone') || ': ' || _preview,
      '/event/' || _event.id::text,
      '/event/' || _event.id::text,
      'View',
      'normal',
      'general',
      'event-comment:' || _comment.id::text || ':' || _recipient.user_id::text
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_event_comment(uuid) TO authenticated;
