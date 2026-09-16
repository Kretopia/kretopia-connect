CREATE OR REPLACE FUNCTION public.create_circle_from_event(
  _event_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _category text DEFAULT 'general',
  _cover_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _host uuid;
  _existing uuid;
  _room_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by, circle_id INTO _host, _existing
  FROM public.creative_jams
  WHERE id = _event_id;

  IF _host IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF _host <> _uid THEN
    RAISE EXCEPTION 'Only the event host can start a Circle';
  END IF;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.spark_rooms (created_by, title, description, category, cover_image_url, is_private, circle_type)
  VALUES (_uid, _title, _description, COALESCE(_category, 'general'), _cover_image_url, true, 'event')
  RETURNING id INTO _room_id;

  INSERT INTO public.spark_room_members (room_id, user_id, role)
  VALUES (_room_id, _uid, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.spark_room_members (room_id, user_id, role)
  SELECT _room_id, jp.user_id, 'member'
  FROM public.jam_participants jp
  WHERE jp.jam_id = _event_id
    AND jp.status IN ('going', 'interested', 'maybe')
    AND jp.user_id <> _uid
  ON CONFLICT DO NOTHING;

  UPDATE public.creative_jams SET circle_id = _room_id WHERE id = _event_id;

  RETURN _room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_circle_from_event(uuid, text, text, text, text) TO authenticated;