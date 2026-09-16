-- Money & Proof Chain: auto-trigger sequential agent actions on milestone completion
-- Trigger 1: Milestone -> 'completed' enqueues orch_run + first proposed action (send_payment_link)
-- Trigger 2: When a chain action is executed, propose the next step

CREATE OR REPLACE FUNCTION public.enqueue_money_proof_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_project RECORD;
  v_creator_name TEXT;
  v_run_id UUID;
  v_recipient_id UUID;
  v_used_today INT;
BEGIN
  -- Only fire on transition INTO 'completed'
  IF NEW.status <> 'completed' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- The project owner (created_by on projects) is the actor (client) who pays
  SELECT * INTO v_project FROM public.projects WHERE id = NEW.project_id;
  IF v_project.id IS NULL THEN RETURN NEW; END IF;

  -- The recipient of payment + credit subject = milestone creator (the creative)
  v_recipient_id := COALESCE(NEW.paid_to, NEW.created_by);
  IF v_recipient_id IS NULL OR v_recipient_id = v_project.created_by THEN
    RETURN NEW;
  END IF;

  -- Owner must have agent_mode_payments ON
  SELECT * INTO v_settings FROM public.orch_settings WHERE user_id = v_project.created_by;
  IF v_settings.user_id IS NULL OR COALESCE(v_settings.agent_mode_payments, false) = false THEN
    RETURN NEW;
  END IF;
  IF COALESCE(v_settings.agents_enabled, true) = false THEN
    RETURN NEW;
  END IF;

  -- Daily cap check
  SELECT COUNT(*) INTO v_used_today
  FROM public.orch_actions
  WHERE user_id = v_project.created_by
    AND proposed_at >= now() - interval '24 hours';
  IF v_used_today >= COALESCE(v_settings.daily_action_limit, 25) THEN
    RETURN NEW;
  END IF;

  -- Get creator display name for preview
  SELECT full_name INTO v_creator_name FROM public.profiles WHERE user_id = v_recipient_id;
  v_creator_name := COALESCE(v_creator_name, 'Collaborator');

  -- Create orch_run for the chain
  INSERT INTO public.orch_runs (user_id, agent_kind, intent_text, status)
  VALUES (
    v_project.created_by,
    'payment',
    format('Close out milestone "%s" on %s', NEW.title, v_project.title),
    'awaiting_approval'
  )
  RETURNING id INTO v_run_id;

  -- Step 1: propose send_payment_link (invoice)
  INSERT INTO public.orch_actions (
    run_id, user_id, tool_name, tool_args,
    risk_level, status, preview_title, preview_body, agent_kind
  ) VALUES (
    v_run_id,
    v_project.created_by,
    'send_payment_link',
    jsonb_build_object(
      'recipient_user_id', v_recipient_id,
      'project_id', NEW.project_id,
      'milestone_id', NEW.id,
      'amount', NEW.amount,
      'description', format('Payment for "%s"', NEW.title),
      '_chain', jsonb_build_object('kind', 'money_proof', 'step', 'invoice', 'milestone_id', NEW.id)
    ),
    'requires_approval',
    'proposed',
    format('Send invoice to %s', v_creator_name),
    format('$%s for "%s". Tap to send the payment link.', NEW.amount, NEW.title),
    'payment'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestone_money_proof_chain ON public.milestones;
CREATE TRIGGER trg_milestone_money_proof_chain
AFTER UPDATE OF status ON public.milestones
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_money_proof_chain();

-- Sequencer: when an executed action is part of the money_proof chain, propose the next step
CREATE OR REPLACE FUNCTION public.advance_money_proof_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain JSONB;
  v_settings RECORD;
  v_milestone RECORD;
  v_project RECORD;
  v_creator_name TEXT;
  v_recipient_id UUID;
BEGIN
  -- Only react when an action just transitioned to 'executed'
  IF NEW.status <> 'executed' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  v_chain := NEW.tool_args -> '_chain';
  IF v_chain IS NULL OR v_chain ->> 'kind' <> 'money_proof' THEN
    RETURN NEW;
  END IF;

  -- Re-check settings on each step (user may have toggled off mid-chain)
  SELECT * INTO v_settings FROM public.orch_settings WHERE user_id = NEW.user_id;
  IF v_settings.user_id IS NULL OR COALESCE(v_settings.agents_enabled, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_milestone FROM public.milestones WHERE id = (v_chain ->> 'milestone_id')::uuid;
  IF v_milestone.id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = v_milestone.project_id;
  v_recipient_id := COALESCE(v_milestone.paid_to, v_milestone.created_by);
  SELECT full_name INTO v_creator_name FROM public.profiles WHERE user_id = v_recipient_id;
  v_creator_name := COALESCE(v_creator_name, 'Collaborator');

  -- Step transitions
  IF v_chain ->> 'step' = 'invoice' THEN
    -- Only proceed to credit if agent_mode_credits is on
    IF COALESCE(v_settings.agent_mode_credits, false) = false THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.orch_actions (
      run_id, user_id, tool_name, tool_args,
      risk_level, status, preview_title, preview_body, agent_kind
    ) VALUES (
      NEW.run_id, NEW.user_id, 'publish_credit',
      jsonb_build_object(
        'project_id', v_milestone.project_id,
        'recipient_user_id', v_recipient_id,
        'milestone_id', v_milestone.id,
        'title', v_project.title,
        'role', 'Collaborator',
        '_chain', jsonb_build_object('kind', 'money_proof', 'step', 'credit', 'milestone_id', v_milestone.id)
      ),
      'requires_approval', 'proposed',
      format('Publish credit for %s', v_creator_name),
      format('Add a verified credit to %s for work on "%s".', v_creator_name, v_project.title),
      'credit'
    );
  ELSIF v_chain ->> 'step' = 'credit' THEN
    INSERT INTO public.orch_actions (
      run_id, user_id, tool_name, tool_args,
      risk_level, status, preview_title, preview_body, agent_kind
    ) VALUES (
      NEW.run_id, NEW.user_id, 'request_vouch',
      jsonb_build_object(
        'recipient_user_id', v_recipient_id,
        'project_id', v_milestone.project_id,
        'context', format('Worked together on "%s"', v_project.title),
        '_chain', jsonb_build_object('kind', 'money_proof', 'step', 'vouch', 'milestone_id', v_milestone.id)
      ),
      'requires_approval', 'proposed',
      format('Ask %s for a vouch', v_creator_name),
      'Trust signal — adds a public endorsement to your profile.',
      'profile'
    );
  ELSIF v_chain ->> 'step' = 'vouch' THEN
    -- Chain complete — mark run completed
    UPDATE public.orch_runs SET status = 'completed', completed_at = now() WHERE id = NEW.run_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_money_proof_chain ON public.orch_actions;
CREATE TRIGGER trg_advance_money_proof_chain
AFTER UPDATE OF status ON public.orch_actions
FOR EACH ROW
EXECUTE FUNCTION public.advance_money_proof_chain();