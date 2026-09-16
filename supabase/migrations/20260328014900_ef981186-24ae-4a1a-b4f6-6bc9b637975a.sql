-- Fix: Allow circle creators to manage channels even if their member role isn't admin
DROP POLICY IF EXISTS "Circle admins can manage channels" ON circle_channels;
CREATE POLICY "Circle admins can manage channels"
ON circle_channels FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM spark_rooms
    WHERE spark_rooms.id = circle_channels.circle_id
    AND spark_rooms.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM spark_room_members
    WHERE spark_room_members.room_id = circle_channels.circle_id
    AND spark_room_members.user_id = auth.uid()
    AND spark_room_members.role = ANY (ARRAY['admin', 'moderator'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM spark_rooms
    WHERE spark_rooms.id = circle_channels.circle_id
    AND spark_rooms.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM spark_room_members
    WHERE spark_room_members.room_id = circle_channels.circle_id
    AND spark_room_members.user_id = auth.uid()
    AND spark_room_members.role = ANY (ARRAY['admin', 'moderator'])
  )
);

-- Also fix: update existing circle creators to have admin role
UPDATE spark_room_members srm
SET role = 'admin'
FROM spark_rooms sr
WHERE srm.room_id = sr.id
AND srm.user_id = sr.created_by
AND srm.role != 'admin';