
-- ============================================================
-- Creative Actions (North Star event log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creative_actions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action_type TEXT NOT NULL,
  ref_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_actions_user_time ON public.creative_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_actions_type_time ON public.creative_actions (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_actions_time ON public.creative_actions (created_at DESC);

GRANT SELECT, INSERT ON public.creative_actions TO authenticated;
GRANT ALL ON public.creative_actions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.creative_actions_id_seq TO authenticated, service_role;

ALTER TABLE public.creative_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own actions"
ON public.creative_actions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users read own actions"
ON public.creative_actions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Helper RPC for client-side / edge-fn logging
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_creative_action(
  _action_type TEXT,
  _ref_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id BIGINT;
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (auth.uid(), _action_type, _ref_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_creative_action(TEXT, UUID, JSONB) TO authenticated;

-- ============================================================
-- Auto-log triggers (server-side, can't be bypassed)
-- ============================================================

-- 1. credit_added
CREATE OR REPLACE FUNCTION public.tg_log_credit_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.user_id, 'credit_added', NEW.id,
    jsonb_build_object('source', NEW.source, 'project_name', NEW.project_name, 'role', NEW.role));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_credit_added ON public.credits;
CREATE TRIGGER trg_log_credit_added AFTER INSERT ON public.credits
FOR EACH ROW EXECUTE FUNCTION public.tg_log_credit_added();

-- 2. connection_accepted
CREATE OR REPLACE FUNCTION public.tg_log_connection_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
    VALUES (NEW.user_id, 'connection_accepted', NEW.id,
      jsonb_build_object('connected_user_id', NEW.connected_user_id));
    INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
    VALUES (NEW.connected_user_id, 'connection_accepted', NEW.id,
      jsonb_build_object('connected_user_id', NEW.user_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_connection_accepted ON public.connections;
CREATE TRIGGER trg_log_connection_accepted AFTER UPDATE OF status ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.tg_log_connection_accepted();

-- 3. message_sent
CREATE OR REPLACE FUNCTION public.tg_log_message_sent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.sender_id, 'message_sent', NEW.id,
    jsonb_build_object('receiver_id', NEW.receiver_id, 'has_attachment', NEW.attachment_url IS NOT NULL));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_message_sent ON public.messages;
CREATE TRIGGER trg_log_message_sent AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_log_message_sent();

-- 4. workspace_created
CREATE OR REPLACE FUNCTION public.tg_log_workspace_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.created_by, 'workspace_created', NEW.id,
    jsonb_build_object('workspace_type', NEW.workspace_type, 'title', NEW.title));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_workspace_created ON public.projects;
CREATE TRIGGER trg_log_workspace_created AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.tg_log_workspace_created();

-- 5. job_application
CREATE OR REPLACE FUNCTION public.tg_log_job_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.applicant_id, 'job_application', NEW.id,
    jsonb_build_object('opportunity_id', NEW.opportunity_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_job_application ON public.applications;
CREATE TRIGGER trg_log_job_application AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.tg_log_job_application();

-- 6. proposal_generated (thrive_documents: decks, proposals, treatments, rate cards)
CREATE OR REPLACE FUNCTION public.tg_log_proposal_generated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.user_id, 'proposal_generated', NEW.id,
    jsonb_build_object('intent', NEW.intent, 'title', NEW.title, 'model', NEW.model_used));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_proposal_generated ON public.thrive_documents;
CREATE TRIGGER trg_log_proposal_generated AFTER INSERT ON public.thrive_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_log_proposal_generated();

-- 7. invoice_generated
CREATE OR REPLACE FUNCTION public.tg_log_invoice_generated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.issued_by, 'invoice_generated', NEW.id,
    jsonb_build_object('total_amount', NEW.total_amount, 'currency', NEW.currency, 'invoice_number', NEW.invoice_number));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_invoice_generated ON public.invoices;
CREATE TRIGGER trg_log_invoice_generated AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_log_invoice_generated();

-- 8. scout_action
CREATE OR REPLACE FUNCTION public.tg_log_scout_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creative_actions (user_id, action_type, ref_id, metadata)
  VALUES (NEW.user_id, 'scout_action', NEW.id,
    jsonb_build_object('action', NEW.action, 'scouted_gig_id', NEW.scouted_gig_id, 'outcome', NEW.outcome));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_scout_action ON public.scouted_gig_actions;
CREATE TRIGGER trg_log_scout_action AFTER INSERT ON public.scouted_gig_actions
FOR EACH ROW EXECUTE FUNCTION public.tg_log_scout_action();

-- ============================================================
-- Reporting views (admin-only via SECURITY DEFINER functions)
-- ============================================================

-- North Star — daily Creative Actions totals + by-type
CREATE OR REPLACE FUNCTION public.get_creative_actions_daily(_days INT DEFAULT 30)
RETURNS TABLE (day DATE, action_type TEXT, action_count BIGINT, unique_users BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (created_at AT TIME ZONE 'UTC')::DATE AS day,
    action_type,
    COUNT(*)::BIGINT AS action_count,
    COUNT(DISTINCT user_id)::BIGINT AS unique_users
  FROM public.creative_actions
  WHERE created_at >= now() - (_days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
$$;
GRANT EXECUTE ON FUNCTION public.get_creative_actions_daily(INT) TO authenticated;

-- DAU / WAU / MAU rollup (based on Creative Actions = real engagement)
CREATE OR REPLACE FUNCTION public.get_active_users_rollup()
RETURNS TABLE (dau BIGINT, wau BIGINT, mau BIGINT, dau_wau_ratio NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT COUNT(DISTINCT user_id) c FROM public.creative_actions
    WHERE created_at >= now() - interval '1 day' AND user_id IS NOT NULL
  ),
  w AS (
    SELECT COUNT(DISTINCT user_id) c FROM public.creative_actions
    WHERE created_at >= now() - interval '7 days' AND user_id IS NOT NULL
  ),
  m AS (
    SELECT COUNT(DISTINCT user_id) c FROM public.creative_actions
    WHERE created_at >= now() - interval '30 days' AND user_id IS NOT NULL
  )
  SELECT
    d.c, w.c, m.c,
    CASE WHEN w.c > 0 THEN ROUND((d.c::NUMERIC / w.c::NUMERIC) * 100, 1) ELSE 0 END
  FROM d, w, m
  WHERE public.has_role(auth.uid(), 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.get_active_users_rollup() TO authenticated;

-- Section KPI snapshot (7d / 30d)
CREATE OR REPLACE FUNCTION public.get_product_kpis()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT jsonb_build_object(
    'growth', jsonb_build_object(
      'signups_7d', (SELECT COUNT(*) FROM auth.users WHERE created_at >= now() - interval '7 days'),
      'signups_30d', (SELECT COUNT(*) FROM auth.users WHERE created_at >= now() - interval '30 days'),
      'total_users', (SELECT COUNT(*) FROM auth.users)
    ),
    'reputation', jsonb_build_object(
      'credits_added_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='credit_added' AND created_at >= now() - interval '7 days'),
      'credits_added_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='credit_added' AND created_at >= now() - interval '30 days'),
      'total_credits', (SELECT COUNT(*) FROM public.credits),
      'vouches_30d', (SELECT COUNT(*) FROM public.credit_vouches WHERE created_at >= now() - interval '30 days')
    ),
    'network', jsonb_build_object(
      'connections_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='connection_accepted' AND created_at >= now() - interval '7 days'),
      'messages_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='message_sent' AND created_at >= now() - interval '7 days'),
      'messages_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='message_sent' AND created_at >= now() - interval '30 days')
    ),
    'opportunities', jsonb_build_object(
      'applications_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='job_application' AND created_at >= now() - interval '7 days'),
      'applications_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='job_application' AND created_at >= now() - interval '30 days'),
      'scout_actions_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='scout_action' AND created_at >= now() - interval '7 days'),
      'open_gigs', (SELECT COUNT(*) FROM public.scouted_gigs WHERE created_at >= now() - interval '7 days')
    ),
    'studios', jsonb_build_object(
      'workspaces_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='workspace_created' AND created_at >= now() - interval '7 days'),
      'workspaces_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='workspace_created' AND created_at >= now() - interval '30 days'),
      'total_workspaces', (SELECT COUNT(*) FROM public.projects),
      'invoices_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='invoice_generated' AND created_at >= now() - interval '30 days')
    ),
    'executive_producer', jsonb_build_object(
      'documents_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='proposal_generated' AND created_at >= now() - interval '7 days'),
      'documents_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE action_type='proposal_generated' AND created_at >= now() - interval '30 days'),
      'total_documents', (SELECT COUNT(*) FROM public.thrive_documents),
      'by_intent', (SELECT jsonb_object_agg(COALESCE(intent,'unknown'), c) FROM (SELECT intent, COUNT(*) c FROM public.thrive_documents WHERE created_at >= now() - interval '30 days' GROUP BY intent) x)
    ),
    'creative_actions_total_7d', (SELECT COUNT(*) FROM public.creative_actions WHERE created_at >= now() - interval '7 days'),
    'creative_actions_total_30d', (SELECT COUNT(*) FROM public.creative_actions WHERE created_at >= now() - interval '30 days')
  ) INTO result;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_product_kpis() TO authenticated;

-- Cohort retention: signup_week vs active_week (returning week with >=1 creative action)
CREATE OR REPLACE FUNCTION public.get_retention_cohorts(_weeks INT DEFAULT 8)
RETURNS TABLE (cohort_week DATE, week_offset INT, cohort_size BIGINT, retained BIGINT, retention_pct NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cohorts AS (
    SELECT u.id AS user_id, date_trunc('week', u.created_at)::DATE AS cohort_week
    FROM auth.users u
    WHERE u.created_at >= now() - (_weeks || ' weeks')::interval
  ),
  activity AS (
    SELECT DISTINCT ca.user_id, date_trunc('week', ca.created_at)::DATE AS active_week
    FROM public.creative_actions ca
    WHERE ca.user_id IS NOT NULL
  ),
  joined AS (
    SELECT
      c.cohort_week,
      GREATEST(0, ((a.active_week - c.cohort_week) / 7))::INT AS week_offset,
      c.user_id
    FROM cohorts c
    LEFT JOIN activity a ON a.user_id = c.user_id AND a.active_week >= c.cohort_week
  ),
  sizes AS (
    SELECT cohort_week, COUNT(DISTINCT user_id) sz FROM cohorts GROUP BY 1
  )
  SELECT
    j.cohort_week,
    j.week_offset,
    s.sz AS cohort_size,
    COUNT(DISTINCT j.user_id)::BIGINT AS retained,
    ROUND((COUNT(DISTINCT j.user_id)::NUMERIC / NULLIF(s.sz,0)::NUMERIC) * 100, 1) AS retention_pct
  FROM joined j
  JOIN sizes s ON s.cohort_week = j.cohort_week
  WHERE j.week_offset IS NOT NULL
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY j.cohort_week, j.week_offset, s.sz
  ORDER BY j.cohort_week DESC, j.week_offset;
$$;
GRANT EXECUTE ON FUNCTION public.get_retention_cohorts(INT) TO authenticated;

-- ============================================================
-- Backfill creative_actions from existing data (last 90 days)
-- ============================================================
INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT user_id, 'credit_added', id, created_at, jsonb_build_object('source', source, 'project_name', project_name)
FROM public.credits WHERE created_at >= now() - interval '90 days' AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT sender_id, 'message_sent', id, created_at, jsonb_build_object('receiver_id', receiver_id)
FROM public.messages WHERE created_at >= now() - interval '90 days' AND sender_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT created_by, 'workspace_created', id, created_at, jsonb_build_object('workspace_type', workspace_type, 'title', title)
FROM public.projects WHERE created_at >= now() - interval '90 days' AND created_by IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT applicant_id, 'job_application', id, created_at, jsonb_build_object('opportunity_id', opportunity_id)
FROM public.applications WHERE created_at >= now() - interval '90 days' AND applicant_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT user_id, 'proposal_generated', id, created_at, jsonb_build_object('intent', intent, 'title', title)
FROM public.thrive_documents WHERE created_at >= now() - interval '90 days' AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT issued_by, 'invoice_generated', id, created_at, jsonb_build_object('total_amount', total_amount, 'currency', currency)
FROM public.invoices WHERE created_at >= now() - interval '90 days' AND issued_by IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT user_id, 'scout_action', id, created_at, jsonb_build_object('action', action, 'scouted_gig_id', scouted_gig_id, 'outcome', outcome)
FROM public.scouted_gig_actions WHERE created_at >= now() - interval '90 days' AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.creative_actions (user_id, action_type, ref_id, created_at, metadata)
SELECT user_id, 'connection_accepted', id, created_at, jsonb_build_object('connected_user_id', connected_user_id)
FROM public.connections WHERE status='accepted' AND created_at >= now() - interval '90 days' AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;
