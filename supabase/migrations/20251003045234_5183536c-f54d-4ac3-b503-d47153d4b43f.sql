-- Update Ethan Auguste's profile to Creator Pro with Founder badge and membership number
UPDATE profiles 
SET 
  subscription_tier = 'creator_pro',
  badge = 'founder',
  membership_number = COALESCE(membership_number, generate_membership_number())
WHERE user_id = 'ef429714-ea32-4f08-a4f9-ef0226f1804b';