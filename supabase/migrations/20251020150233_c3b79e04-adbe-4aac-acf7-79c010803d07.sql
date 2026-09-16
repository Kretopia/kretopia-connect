-- Enable pg_net extension for email sending
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update email trigger functions to use proper Supabase URL
-- Note: The functions reference app.settings which may not be configured
-- We'll check if email sending is working after this

-- Check if we have recent profile creations that should have triggered welcome emails
SELECT 
  p.user_id,
  p.full_name,
  p.created_at,
  au.email
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
WHERE p.created_at > now() - interval '7 days'
ORDER BY p.created_at DESC
LIMIT 10;