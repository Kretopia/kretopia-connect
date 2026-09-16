-- Warning flagged by the security scanner: "Any authenticated user can
-- claim unverified historical project-credit roles as their own."
--
-- Root cause, confirmed by reading the live policies and the two actual
-- frontend call sites (ProjectCreditsDialog.tsx, ConfirmCreditBanner.tsx):
--
--   "Project owner can assign credits" (INSERT)
--     WITH CHECK (assigned_by = auth.uid())
--   -- despite the name, this never checks the inserting user has any
--   -- relationship to project_id at all. Any authenticated user can
--   -- insert {project_id: <any project>, user_id: self, assigned_by: self,
--   -- status: 'confirmed'} and fabricate a fake, already-"confirmed"
--   -- credit for themselves on a project they have nothing to do with.
--
--   "Users can confirm their own credits" (UPDATE)
--     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
--   -- only checks who the row belongs to, not which columns changed or
--   -- what status is being set. The credited user can rewrite role,
--   -- project_id (re-pointing an existing credit at a totally different
--   -- project) or assigned_by on their own row, or set status back to
--   -- anything at all.
--
-- Fix: INSERT now requires the same project-membership check used
-- everywhere else in this codebase (user_has_project_access), and only
-- lets a fresh insert land as 'confirmed' when the assigner is crediting
-- themselves -- exactly what ProjectCreditsDialog.tsx already does for the
-- owner's own role; every other assignment still starts 'pending' and
-- needs the credited user's own confirmation. UPDATE is locked to the
-- columns the confirm/decline flow actually touches (status, confirmed_at,
-- credit_id) via a column-level GRANT -- the same REVOKE-then-narrow-GRANT
-- pattern already used for milestones in this repo -- with status
-- restricted to 'confirmed'/'declined' only.

-- ── INSERT ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Project owner can assign credits" ON public.project_credits;
CREATE POLICY "Project members can assign credits"
ON public.project_credits
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND public.user_has_project_access(project_id, auth.uid())
  AND (
    status IS NULL
    OR status = 'pending'
    OR (status = 'confirmed' AND user_id = auth.uid())
  )
);

-- ── UPDATE ───────────────────────────────────────────────────────────────
REVOKE UPDATE ON public.project_credits FROM authenticated, anon;
GRANT UPDATE (status, confirmed_at, credit_id, updated_at)
  ON public.project_credits TO authenticated;

DROP POLICY IF EXISTS "Users can confirm their own credits" ON public.project_credits;
CREATE POLICY "Users can confirm their own credits"
ON public.project_credits
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND status IN ('confirmed', 'declined'));
