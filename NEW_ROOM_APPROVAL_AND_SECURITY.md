# New Room — Approval and Security Model

## Draft → review → confirm, verified live

No `projects` write happens before the explicit Create click — confirmed both by reading `createProject()` (only called from the review screen's Create buttons) and by live browser testing: submitted a real brief, reached a full review screen, clicked "Start over" instead of Create, confirmed nothing was written (no network insert fired, `clearDraft()` ran).

## Project ownership — verified sound, not assumed

`created_by` is not client-trusted despite the client sending it in the insert payload. A `BEFORE INSERT` trigger (`set_project_created_by`, `SECURITY DEFINER`, migration `20251005014449`, last touched `20260524111719` to add a service-role-context exception that doesn't weaken the authenticated-user case) unconditionally overwrites `NEW.created_by = auth.uid()` whenever a session exists. Traced the full migration history for the `projects` table's RLS (32 migrations touch it) to confirm no later change reintroduced a client-trusted-ownership path. INSERT policy (`WITH CHECK (auth.uid() IS NOT NULL)`) is permissive by design — safe because the trigger, not the policy, is what enforces ownership. SELECT/UPDATE use a `SECURITY DEFINER` `user_has_project_access()` helper (created + owned/matched/collaborator cases); DELETE is creator-only.

**No cross-user creation, read, or write path found.**

## What's real vs. claimed in the UI copy

The trust line ("Nothing becomes a Project until you confirm the draft. Kreto will not invite collaborators, send messages or emails, or trigger payments without your approval.") is accurate to what the code does — `createProject()` does not invite, message, or charge anyone; it inserts a project row, optional tasks, and scaffolds default folders/tasks, all owned by the confirming user.

## Duplicate-project race — the double-click case closed, the network-retry case documented

The `creating` React state boolean disabling the Create buttons was real but not airtight: state updates lag a render behind the click handler, so two near-simultaneous taps could both fire before either saw `creating: true`. Fixed with a synchronous `creatingRef` guard, checked and set at the top of `createProject()` before any async work -- a ref updates immediately, so the second call in a fast double-click reads it as already-in-progress and returns early. Verified by a test that drives the full flow to the review screen and double-clicks Create, asserting the `projects` insert fires exactly once.

**Remaining, narrower gap**: a client retry after a genuinely lost response (the original request succeeded server-side but the client's connection dropped before it saw the reply) is not covered by a ref that resets on remount/unmount -- that case needs a true server-side idempotency key (client-generated UUID in a unique-constrained column, checked before insert), which needs a migration and is not applied this pass per the standing rule against unprompted migrations. This residual case requires both a lost response *and* the user manually retrying, which is materially narrower than the double-click case that's now closed.

## Minor, low-severity, not fixed this pass

No server-side file-size/MIME enforcement for the `doc`/`audio` base64 payload sent to `extract-brief` (client-side 25MB cap only) — a cost/abuse vector via the AI gateway, not a data-authorization issue, since nothing from that path is persisted server-side.
