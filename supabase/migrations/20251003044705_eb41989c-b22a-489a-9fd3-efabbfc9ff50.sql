-- First, drop the old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

-- Update all profiles with old tier names to new tier names
UPDATE profiles SET subscription_tier = 'creator_pro' WHERE subscription_tier IN ('enterprise', 'pro');
UPDATE profiles SET subscription_tier = 'thriver' WHERE subscription_tier = 'basic';

-- Now add the new constraint with correct tier names
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'thriver', 'creator_pro'));

-- Update Gabriel's profile to have Founder badge and membership number
UPDATE profiles 
SET 
  badge = 'founder',
  membership_number = COALESCE(membership_number, generate_membership_number())
WHERE user_id = 'ece546d8-4f58-4c0a-9033-9848c6d2718e';