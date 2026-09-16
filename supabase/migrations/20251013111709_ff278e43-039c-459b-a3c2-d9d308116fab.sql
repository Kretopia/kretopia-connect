-- Create payment_disputes table
CREATE TABLE IF NOT EXISTS payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  payment_intent_id text,
  disputed_by uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  details text NOT NULL,
  evidence text,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view disputes they're involved in
CREATE POLICY "Users can view their disputes"
  ON payment_disputes
  FOR SELECT
  USING (
    auth.uid() = disputed_by 
    OR auth.uid() IN (
      SELECT created_by FROM milestones WHERE id = payment_disputes.milestone_id
      UNION
      SELECT paid_to FROM milestones WHERE id = payment_disputes.milestone_id
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Policy: Users can create disputes for milestones they're part of
CREATE POLICY "Users can create disputes"
  ON payment_disputes
  FOR INSERT
  WITH CHECK (
    auth.uid() = disputed_by
    AND auth.uid() IN (
      SELECT created_by FROM milestones WHERE id = payment_disputes.milestone_id
      UNION
      SELECT paid_to FROM milestones WHERE id = payment_disputes.milestone_id
    )
  );

-- Policy: Admins can update disputes
CREATE POLICY "Admins can update disputes"
  ON payment_disputes
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for performance
CREATE INDEX idx_payment_disputes_milestone ON payment_disputes(milestone_id);
CREATE INDEX idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX idx_payment_disputes_disputed_by ON payment_disputes(disputed_by);

-- Trigger for updated_at
CREATE TRIGGER update_payment_disputes_updated_at
  BEFORE UPDATE ON payment_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();