-- M11 (docs/roadmap/schema-impact-report.md): any accepted collaborator, guests included, could change a project's
-- status, recap, commercial terms and links to other objects. The interface already treats these as owner actions.
-- Only the project owner, the project's client (client_user_id, which only the owner can set since M6) and the
-- service role (edge functions: auth.uid() is NULL there) may change these twelve columns; everyone else gets an
-- error. Unchanged values pass, so a full-row update by a member still works. Collaboration columns (title,
-- description, cover, mood, folder, pinned stage, setup flag, video-call fields, client name) stay open.
-- No SQL function in public updates projects, and the app and edge functions that change these columns run as the
-- owner, the client or the service role.
-- Applied to production on 2026-10-21 with approval; this file records it so the migrations match.
-- Rollback: DROP TRIGGER trg_guard_project_owner_columns ON public.projects; DROP FUNCTION public.guard_project_owner_columns();

CREATE OR REPLACE FUNCTION public.guard_project_owner_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.created_by
     AND auth.uid() IS DISTINCT FROM OLD.client_user_id
     AND (
          NEW.status IS DISTINCT FROM OLD.status
       OR NEW.recap_published IS DISTINCT FROM OLD.recap_published
       OR NEW.recap_summary IS DISTINCT FROM OLD.recap_summary
       OR NEW.recap_token IS DISTINCT FROM OLD.recap_token
       OR NEW.budget IS DISTINCT FROM OLD.budget
       OR NEW.deadline IS DISTINCT FROM OLD.deadline
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.deal_type IS DISTINCT FROM OLD.deal_type
       OR NEW.workspace_type IS DISTINCT FROM OLD.workspace_type
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.track_as_credit IS DISTINCT FROM OLD.track_as_credit
     ) THEN
    RAISE EXCEPTION 'only the project owner or its client can change the status, recap, budget, deadline or links of a project';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_project_owner_columns ON public.projects;
CREATE TRIGGER trg_guard_project_owner_columns
  BEFORE UPDATE OF status, recap_published, recap_summary, recap_token, budget, deadline, currency, deal_type,
                   workspace_type, match_id, event_id, track_as_credit ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_owner_columns();
