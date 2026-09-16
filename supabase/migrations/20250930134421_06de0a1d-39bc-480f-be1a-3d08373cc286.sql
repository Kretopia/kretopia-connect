-- Add subscription tracking to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_product_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone;

-- Create milestones table for project payment tracking
CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'paid')),
  due_date timestamp with time zone,
  paid_to uuid REFERENCES profiles(user_id),
  paid_at timestamp with time zone,
  created_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Users can view milestones for projects they're part of
CREATE POLICY "Users can view milestones in their projects"
ON milestones FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Users can create milestones in their projects
CREATE POLICY "Users can create milestones in their projects"
ON milestones FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Users can update milestones in their projects
CREATE POLICY "Users can update milestones in their projects"
ON milestones FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

-- Add trigger to update updated_at
CREATE TRIGGER update_milestones_updated_at
BEFORE UPDATE ON milestones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();