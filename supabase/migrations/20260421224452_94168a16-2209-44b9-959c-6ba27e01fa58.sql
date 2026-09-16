-- 1. Add owner response columns
ALTER TABLE public.credit_claim_disputes
  ADD COLUMN IF NOT EXISTS owner_response TEXT,
  ADD COLUMN IF NOT EXISTS owner_responded_at TIMESTAMPTZ;

-- 2. Allow current owner to update their own response (status changes still restricted to admins/resolution flow)
DROP POLICY IF EXISTS "Owner can respond to dispute" ON public.credit_claim_disputes;
CREATE POLICY "Owner can respond to dispute"
ON public.credit_claim_disputes
FOR UPDATE
TO authenticated
USING (auth.uid() = current_owner_id)
WITH CHECK (auth.uid() = current_owner_id);

-- 3. Notify the credit owner when a new dispute is filed
CREATE OR REPLACE FUNCTION public.notify_on_credit_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenger_name TEXT;
  project_title TEXT;
BEGIN
  SELECT full_name INTO challenger_name FROM profiles WHERE user_id = NEW.challenger_id;
  SELECT project_name INTO project_title FROM credits WHERE id = NEW.credit_id;

  PERFORM create_notification(
    NEW.current_owner_id,
    '⚠️ Credit Dispute Filed',
    COALESCE(challenger_name, 'Someone') || ' is challenging your credit on "' || COALESCE(project_title, 'a project') || '". You have 7 days to respond.',
    'dispute',
    '/dispute-manage/' || NEW.id::text,
    '/dispute-manage/' || NEW.id::text,
    'Review Dispute',
    NULL,
    'high',
    'dispute'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_credit_dispute ON public.credit_claim_disputes;
CREATE TRIGGER trg_notify_on_credit_dispute
AFTER INSERT ON public.credit_claim_disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_credit_dispute();

-- 4. Notify the challenger when a dispute is resolved
CREATE OR REPLACE FUNCTION public.notify_on_dispute_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_title TEXT;
  status_msg TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected', 'transferred') THEN
    RETURN NEW;
  END IF;

  SELECT project_name INTO project_title FROM credits WHERE id = NEW.credit_id;

  status_msg := CASE NEW.status
    WHEN 'approved' THEN '✅ Your dispute on "' || COALESCE(project_title, 'a project') || '" was approved.'
    WHEN 'transferred' THEN '🎉 The credit for "' || COALESCE(project_title, 'a project') || '" has been transferred to you.'
    WHEN 'rejected' THEN '❌ Your dispute on "' || COALESCE(project_title, 'a project') || '" was not upheld.'
  END;

  PERFORM create_notification(
    NEW.challenger_id,
    'Dispute Update',
    status_msg,
    'dispute',
    '/profile',
    '/profile',
    'View Profile',
    NULL,
    'high',
    'dispute'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_dispute_resolution ON public.credit_claim_disputes;
CREATE TRIGGER trg_notify_on_dispute_resolution
AFTER UPDATE ON public.credit_claim_disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_dispute_resolution();