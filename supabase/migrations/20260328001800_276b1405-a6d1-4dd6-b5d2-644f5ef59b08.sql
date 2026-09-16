
-- Add paid circle and moderation columns to spark_rooms
ALTER TABLE public.spark_rooms 
  ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_monthly numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS circle_type text DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS cover_url text;

-- Add role and pinned to spark_room_members
ALTER TABLE public.spark_room_members
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';

-- Add is_pinned to spark_room_messages
ALTER TABLE public.spark_room_messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_by text;

-- Link events to circles
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.spark_rooms(id) ON DELETE SET NULL;

-- Circle subscriptions table for paid circles
CREATE TABLE IF NOT EXISTS public.circle_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid REFERENCES public.spark_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  amount numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.circle_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.circle_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Circle owners can view subscriptions" ON public.circle_subscriptions
  FOR SELECT TO authenticated USING (
    circle_id IN (SELECT id FROM public.spark_rooms WHERE created_by = auth.uid())
  );
