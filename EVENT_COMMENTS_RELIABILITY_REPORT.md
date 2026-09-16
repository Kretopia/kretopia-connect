# Event Comments — Reliability Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`. `BROWSER_VERIFIED` not possible — no host/participant test account in this environment.

## Root cause (from `DEADLINE_DAY_EVENTS_AND_UX_AUDIT.md` §F.1/F.2)

1. **Event hosts could not actually delete other participants' comments**, despite `EventComments.tsx` showing them a delete button for exactly that (`isCreator || comment.user_id === user?.id` gate). The `event_comments` DELETE policy was author-only (`auth.uid() = user_id`), with no host exception ever added. Because an RLS-filtered delete matches zero rows rather than raising an error, the host's click silently took the success path client-side — the comment reappeared on the next reload while the host believed it was gone.
2. **Co-hosts had no real capability**, despite `EventCohosts.tsx` reading "Add co-hosts who can help manage this event." The `event_cohosts` table was never referenced by the `creative_jams` UPDATE policy — a co-host has no more edit rights on the event than a stranger.

## Fixes

**1. Comment moderation — migration + client hardening**

`supabase/migrations/20260906120000_event_host_comment_moderation.sql` replaces the DELETE policy:

```sql
CREATE POLICY "Users can delete own comments or event host can moderate"
  ON public.event_comments FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = event_comments.event_id AND j.created_by = auth.uid())
  );
```

Scoped narrowly to what the existing UI already promises (the host can moderate their own event's thread) — cohosts were deliberately **not** included here, since their capability boundary is a separate, unresolved product question (see below).

Also hardened `EventComments.tsx`'s `handleDelete` to add `.select('id')` after the delete call and treat an empty result as a failure (toast shown) rather than a silent success. This closes the underlying reliability gap regardless of the specific RLS policy — any future permission edge case that silently filters a delete to zero rows will now surface as a visible, recoverable error instead of a false "deleted" state, directly per this brief's own reliability rule.

**2. Co-host copy — accuracy fix, no permission change**

Chose the conservative option rather than unilaterally deciding to extend real edit rights to co-hosts (a genuinely open product question — edit which fields? delete the event too? — not something to resolve inside a deadline-day pass). Changed `EventCohosts.tsx`'s empty-state copy from "Add co-hosts who can help manage this event" to **"Add co-hosts to credit them on this event"** — accurate to what the feature currently does (list and credit collaborators), with no change to any permission or RLS policy.

**Deferred, flagged `REQUIRES_PRODUCT_DECISION`**: whether co-hosts should eventually get real edit rights on `creative_jams`, and if so, which fields. Not resolved in this pass.

## Other confirmed-fine reliability properties (no change needed)

- Realtime is genuinely live (`postgres_changes` subscription, not polling or fake) — `EventComments.tsx:49-65`.
- Author is always derived from the authenticated session, never client-editable.
- XSS-safe (plain JSX text interpolation, not `dangerouslySetInnerHTML`).
- Loading/empty/signed-out/non-participant states are all present and distinct.
- Push notifications to other commenters are protected by a server-side relationship check (`send-push-notification`'s `hasRealRelationship()`) — cannot be abused to spam arbitrary users.

## Not implemented, out of scope for this pass

- Comment length limit (no `CHECK` constraint, no client `maxLength`) — minor abuse-surface, `DEFERRED_AFTER_DEADLINE`.
- True server-side rate-limiting on comment posts (currently just a `disabled={sending}` UI guard) — `DEFERRED_AFTER_DEADLINE`.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: not possible in this environment (no host/participant test account) — same limitation noted throughout this project. High confidence in the RLS fix's correctness since it mirrors the exact `EXISTS (... creative_jams ... created_by = auth.uid())` pattern already proven correct elsewhere in this schema (e.g., the event comments INSERT policy itself uses the identical join).

## Deployment steps required

1. Apply `20260906120000_event_host_comment_moderation.sql` via the Lovable Cloud SQL editor. `REQUIRES_MIGRATION_APPROVAL`.
2. No edge function redeploy needed — this is a database policy change and two frontend files only.
3. Once applied, verify live: as a host, delete another participant's comment, hard-refresh, confirm it stays deleted (not just optimistically removed from local state).
