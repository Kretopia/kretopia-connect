
-- Add enterprise as valid subscription tier
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise'));

-- Upgrade current user to enterprise
UPDATE profiles 
SET 
  subscription_tier = 'enterprise',
  subscription_status = 'active',
  subscription_product_id = 'enterprise_plan'
WHERE user_id IN (SELECT id FROM auth.users LIMIT 1);
