-- M0a (docs/roadmap/schema-impact-report.md): projects.created_by could be set by any member, because the
-- UPDATE policy has no WITH CHECK and the column is updatable. This makes it immutable for signed-in callers.
-- Already applied to production on 2026-10-19 with approval; this file records it so the migrations match.
-- The service role (edge functions) is unaffected: auth.uid() is NULL there.
-- Rollback: DROP TRIGGER trg_guard_project_created_by ON public.projects; DROP FUNCTION public.guard_project_created_by();

CREATE OR REPLACE FUNCTION public.guard_project_created_by() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'projects.created_by is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_project_created_by ON public.projects;
CREATE TRIGGER trg_guard_project_created_by BEFORE UPDATE OF created_by ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_created_by();
