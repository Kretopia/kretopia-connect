
CREATE OR REPLACE FUNCTION public.get_creative_action_funnels(
  _start timestamptz DEFAULT (now() - interval '30 days'),
  _end timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  -- Scout
  s_scouted int; s_opened int; s_drafted int; s_clicked int;
  -- Connection
  c_sent int; c_accepted int; c_messaged int;
  -- Workspace
  w_created int; w_task int; w_deliv int;
  -- Invoice
  i_draft int; i_sent int; i_paid int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Scout funnel
  SELECT count(*) INTO s_scouted FROM scouted_gigs WHERE created_at BETWEEN _start AND _end;
  SELECT count(DISTINCT scouted_gig_id) INTO s_opened FROM scouted_gig_actions
    WHERE action = 'opened' AND created_at BETWEEN _start AND _end;
  SELECT count(DISTINCT scouted_gig_id) INTO s_drafted FROM scouted_gig_actions
    WHERE action = 'drafted' AND created_at BETWEEN _start AND _end;
  SELECT count(DISTINCT scouted_gig_id) INTO s_clicked FROM scouted_gig_actions
    WHERE action IN ('apply_clicked','applied') AND created_at BETWEEN _start AND _end;

  -- Connection funnel
  SELECT count(*) INTO c_sent FROM connections WHERE created_at BETWEEN _start AND _end;
  SELECT count(*) INTO c_accepted FROM connections
    WHERE status = 'accepted' AND created_at BETWEEN _start AND _end;
  SELECT count(DISTINCT c.id) INTO c_messaged
    FROM connections c
    WHERE c.status = 'accepted'
      AND c.created_at BETWEEN _start AND _end
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE ((m.sender_id = c.requester_id AND m.recipient_id = c.recipient_id)
            OR (m.sender_id = c.recipient_id AND m.recipient_id = c.requester_id))
      );

  -- Workspace funnel
  SELECT count(*) INTO w_created FROM projects WHERE created_at BETWEEN _start AND _end;
  SELECT count(DISTINCT p.id) INTO w_task FROM projects p
    WHERE p.created_at BETWEEN _start AND _end
      AND EXISTS (SELECT 1 FROM project_tasks t WHERE t.project_id = p.id);
  SELECT count(DISTINCT p.id) INTO w_deliv FROM projects p
    WHERE p.created_at BETWEEN _start AND _end
      AND EXISTS (SELECT 1 FROM project_deliverables d WHERE d.project_id = p.id);

  -- Invoice funnel (status reflects current; approximation)
  SELECT count(*) INTO i_draft FROM invoices WHERE created_at BETWEEN _start AND _end;
  SELECT count(*) INTO i_sent FROM invoices
    WHERE status IN ('sent','paid') AND created_at BETWEEN _start AND _end;
  SELECT count(*) INTO i_paid FROM invoices
    WHERE status = 'paid' AND created_at BETWEEN _start AND _end;

  result := jsonb_build_object(
    'scout', jsonb_build_array(
      jsonb_build_object('label','Scouted',       'count', s_scouted),
      jsonb_build_object('label','Opened',        'count', s_opened),
      jsonb_build_object('label','Drafted reply', 'count', s_drafted),
      jsonb_build_object('label','Applied',       'count', s_clicked)
    ),
    'connection', jsonb_build_array(
      jsonb_build_object('label','Requests sent','count', c_sent),
      jsonb_build_object('label','Accepted',     'count', c_accepted),
      jsonb_build_object('label','Messaged',     'count', c_messaged)
    ),
    'workspace', jsonb_build_array(
      jsonb_build_object('label','Workspaces created','count', w_created),
      jsonb_build_object('label','Added a task',      'count', w_task),
      jsonb_build_object('label','Added deliverable', 'count', w_deliv)
    ),
    'invoice', jsonb_build_array(
      jsonb_build_object('label','Drafted','count', i_draft),
      jsonb_build_object('label','Sent',   'count', i_sent),
      jsonb_build_object('label','Paid',   'count', i_paid)
    ),
    'window', jsonb_build_object('start', _start, 'end', _end)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_creative_action_funnels(timestamptz, timestamptz) TO authenticated;
