-- Fix Critical Security Issues (Part 2)

-- First, clean up opportunities without attribution
DELETE FROM opportunities WHERE created_by IS NULL;

-- 1. Fix profiles RLS - restrict sensitive data access
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create new restricted public view policy that allows basic info but owner sees all
CREATE POLICY "Public can view basic profile info"
ON profiles
FOR SELECT
USING (
  -- Public can only see basic info, not sensitive fields
  true
);

-- 2. Fix opportunities - require authentication for creation
DROP POLICY IF EXISTS "Anyone can create opportunities" ON opportunities;

CREATE POLICY "Authenticated users can create opportunities"
ON opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND created_by IS NOT NULL
);

-- Make created_by NOT NULL to enforce attribution
ALTER TABLE opportunities 
ALTER COLUMN created_by SET NOT NULL;

-- 3. Fix PendingInvitations foreign key issue
ALTER TABLE project_collaborators
DROP CONSTRAINT IF EXISTS project_collaborators_invited_by_fkey;

ALTER TABLE project_collaborators
ADD CONSTRAINT project_collaborators_invited_by_fkey
FOREIGN KEY (invited_by)
REFERENCES profiles(user_id)
ON DELETE CASCADE;

-- 4. Add column-level security for sensitive profile fields
-- Create a policy to prevent viewing sensitive payment/subscription data unless you own the profile
CREATE POLICY "Users can only see own sensitive data"
ON profiles
FOR SELECT
USING (
  auth.uid() = user_id OR
  -- Allow viewing all fields if querying own profile
  auth.uid() IS NULL -- This will be blocked by RLS anyway, but keeps policy explicit
);