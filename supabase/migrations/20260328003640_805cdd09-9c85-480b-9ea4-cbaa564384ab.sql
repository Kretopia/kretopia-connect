
-- Circle channels (like Discord topics/segments)
CREATE TABLE public.circle_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '💬',
  channel_type TEXT NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'announcements', 'events', 'shop', 'media')),
  position INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.circle_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view circle channels"
  ON public.circle_channels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Circle admins can manage channels"
  ON public.circle_channels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spark_room_members
      WHERE room_id = circle_channels.circle_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

-- Add channel_id to messages so messages can be scoped to channels
ALTER TABLE public.spark_room_messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.circle_channels(id) ON DELETE SET NULL;

-- Function to auto-create default channel when a circle is created
CREATE OR REPLACE FUNCTION public.create_default_circle_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.circle_channels (circle_id, name, icon_emoji, channel_type, is_default, created_by)
  VALUES (NEW.id, 'General', '💬', 'text', true, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_circle_created_create_channel
  AFTER INSERT ON public.spark_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_circle_channel();
