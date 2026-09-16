CREATE POLICY "Room creators can add members"
ON public.spark_room_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spark_rooms
    WHERE spark_rooms.id = spark_room_members.room_id
      AND spark_rooms.created_by = auth.uid()
  )
);