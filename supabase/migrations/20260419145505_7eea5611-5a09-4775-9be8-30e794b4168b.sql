
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spark_room_members
    WHERE room_id = _room_id AND user_id = _user_id
  );
$$;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='spark_room_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.spark_room_members', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view their own memberships"
  ON public.spark_room_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view co-members of their rooms"
  ON public.spark_room_members FOR SELECT
  USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "Users can join rooms"
  ON public.spark_room_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave rooms"
  ON public.spark_room_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Room creators can remove members"
  ON public.spark_room_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.spark_rooms r
    WHERE r.id = spark_room_members.room_id AND r.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS "Members can view their rooms" ON public.spark_rooms;
CREATE POLICY "Members can view their rooms"
  ON public.spark_rooms FOR SELECT
  USING (public.is_room_member(id, auth.uid()) OR created_by = auth.uid() OR COALESCE(is_private, true) = false);

CREATE OR REPLACE FUNCTION public.get_my_group_rooms()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  cover_image_url text,
  icon_emoji text,
  created_by uuid,
  member_count integer,
  message_count integer,
  invite_code text,
  is_private boolean,
  circle_type text,
  created_at timestamptz,
  updated_at timestamptz,
  my_role text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.title, r.description, r.cover_image_url, r.icon_emoji, r.created_by,
         r.member_count, r.message_count, r.invite_code, r.is_private, r.circle_type,
         r.created_at, r.updated_at, m.role::text
  FROM public.spark_rooms r
  JOIN public.spark_room_members m ON m.room_id = r.id
  WHERE m.user_id = auth.uid() AND COALESCE(r.is_active, true) = true
  ORDER BY r.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.join_group_by_invite(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_room_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO v_room_id FROM public.spark_rooms WHERE invite_code = _invite_code LIMIT 1;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.spark_room_members (room_id, user_id, role)
  VALUES (v_room_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
  RETURN v_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_group_room(_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spark_rooms WHERE id = _room_id AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Only the group creator can delete this group';
  END IF;
  DELETE FROM public.spark_room_members WHERE room_id = _room_id;
  DELETE FROM public.spark_rooms WHERE id = _room_id;
  RETURN true;
END;
$$;
