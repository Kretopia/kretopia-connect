-- M12 (docs/roadmap/schema-impact-report.md): projects_status_check allowed only active, completed, paused and
-- cancelled, but the app treats `archived` as a status everywhere it reads one (Today, the morning pulse, the Studio
-- dashboard, the wrap-up card) and three writers set it (the project settings menu, the older settings component and
-- the server tool that archives a project). Every one of those writes was rejected, so archiving never worked.
-- The check now also allows `archived`. Nothing else about it changes, and no existing row is touched (none is
-- archived). Who may set it is unchanged: since M11 only the owner, the client or the service role.
-- Applied to production on 2026-10-21 on the owner's delegation; this file records it so the migrations match.
-- Rollback (only while no project is archived): ALTER TABLE public.projects DROP CONSTRAINT projects_status_check,
--   ADD CONSTRAINT projects_status_check CHECK (status = ANY (ARRAY['active', 'completed', 'paused', 'cancelled']));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check,
  ADD CONSTRAINT projects_status_check CHECK (status = ANY (ARRAY['active', 'completed', 'paused', 'cancelled', 'archived']));
