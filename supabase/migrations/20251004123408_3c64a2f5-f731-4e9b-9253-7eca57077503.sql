-- Add streak tracking columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_date DATE,
ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;

-- Create push_subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS on push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update streak
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user logged in today
  IF NEW.last_active_date = CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  
  -- Check if streak continues (logged in yesterday)
  IF NEW.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN
    NEW.streak_count := NEW.streak_count + 1;
    NEW.longest_streak := GREATEST(NEW.longest_streak, NEW.streak_count);
  -- Check if streak is broken (more than 1 day gap) and no freeze available
  ELSIF NEW.last_active_date < CURRENT_DATE - INTERVAL '1 day' AND NEW.streak_freeze_count = 0 THEN
    NEW.streak_count := 1; -- Reset to 1 for today
  -- If freeze available, use it
  ELSIF NEW.last_active_date < CURRENT_DATE - INTERVAL '1 day' AND NEW.streak_freeze_count > 0 THEN
    NEW.streak_freeze_count := NEW.streak_freeze_count - 1;
    NEW.streak_count := NEW.streak_count + 1;
    NEW.longest_streak := GREATEST(NEW.longest_streak, NEW.streak_count);
  ELSE
    NEW.streak_count := 1; -- First day
  END IF;
  
  NEW.last_active_date := CURRENT_DATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update streak on profile update
CREATE TRIGGER update_streak_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
EXECUTE FUNCTION update_user_streak();

-- Add realtime for push_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;