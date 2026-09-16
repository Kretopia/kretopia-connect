-- Two confirmed-live bugs, same root cause: application code shipped a new
-- status value for a table's status column, but the table's own CHECK
-- constraint was never updated to allow it -- so every write using that
-- value silently rolls back on a constraint violation. Same class of bug
-- already found and fixed once for credits.verification_status='peer'
-- (20260819140000_fix_credits_peer_status_constraint.sql).

-- 1. projects.status: ProjectSettings.tsx's "Archive" action writes
--    status='archived' (and the settings UI's own status <Select> offers
--    "Archived" as a choice), but projects_status_check has only ever
--    allowed active|completed|paused|cancelled since the table was
--    created (20250930110444_...sql) -- clicking Archive has always
--    failed with a generic "Failed to save" toast. WorkHome.tsx and
--    WrapProjectCard.tsx already read project.status === "archived"
--    defensively, confirming the intent was always for this to be a real,
--    distinct status (a project hidden from the active list without
--    claiming success/failure/pause), not a bug in the reading code.
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'archived'));

-- 2. invoices.status: quotes and invoices share this table via a
--    document_type discriminator. InvoiceGenerator.tsx's "convert quote to
--    invoice" flow creates the new invoice row, then tries to mark the
--    original quote row status='accepted' so it reads as
--    accepted-and-converted rather than still-pending -- but
--    invoices_status_check has only ever allowed
--    draft|sent|paid|cancelled|overdue, so that second update has been
--    silently failing since the feature shipped (the `as any` cast at the
--    call site is a tell the developer worked around TypeScript flagging
--    this rather than fixing it).
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue', 'accepted'));
