-- M6 (docs/roadmap/schema-impact-report.md): any accepted collaborator, guests included, could change
-- projects.client_user_id, agent_user_id, creative_user_ids and agent_mode. client_user_id is the payer authority
-- in the milestone and escrow paths, so these four columns can only be changed by the project owner or by the
-- service role (edge functions: auth.uid() is NULL there). Unchanged values pass, so a full-row update by a
-- member still works. No flow writes these columns today; the app and the edge functions only read them.
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: DROP TRIGGER trg_guard_project_payer_columns ON public.projects; DROP FUNCTION public.guard_project_payer_columns();

CREATE OR REPLACE FUNCTION public.guard_project_payer_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM OLD.created_by AND (
       NEW.client_user_id IS DISTINCT FROM OLD.client_user_id
    OR NEW.agent_user_id IS DISTINCT FROM OLD.agent_user_id
    OR NEW.creative_user_ids IS DISTINCT FROM OLD.creative_user_ids
    OR NEW.agent_mode IS DISTINCT FROM OLD.agent_mode
  ) THEN
    RAISE EXCEPTION 'only the project owner can change the client, agent or creatives of a project';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_project_payer_columns ON public.projects;
CREATE TRIGGER trg_guard_project_payer_columns
  BEFORE UPDATE OF client_user_id, agent_user_id, creative_user_ids, agent_mode ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_payer_columns();
