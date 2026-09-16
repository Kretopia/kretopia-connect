# Studio Finding 3 Remediation Report

**Status: code fixed, NOT deployed — `BLOCKED_MIGRATION_APPROVAL` doesn't
quite apply here (there's no SQL), but the same discipline does: this
is a prepared Edge Function change awaiting manual deployment, not
something applied by this session.**

Remediation for `STUDIO_CURRENT_STATE_AUDIT.md` §7 finding 3
(`scope-guardian` IDOR). Unlike finding 1, this needed no database
migration — it's a single missing authorization check in application
code.

## The vulnerability, confirmed by reading the live code

`supabase/functions/scope-guardian/index.ts` verified the caller's JWT
(a real, logged-in user) but never checked that the `projectId` in the
request body belonged to or was shared with that user. Before fetching
project data, it went straight from "is this a valid token" to
"fetch `projects.title/description/status` and every
`milestones.title/description/amount/status` for whatever `projectId`
was supplied" (old lines 44–68).

That data isn't returned to the caller verbatim, but it's embedded
directly into the system/user prompt sent to the AI for all three
actions (`analyze_brief`, `generate_milestones`, `check_scope_drift`),
and the AI's response — which *is* returned directly to the caller — is
built from that context. An authenticated attacker who knew or guessed
another user's project UUID could reliably get that project's brief and
milestone amounts reflected back through the AI's `summary`/
`explanation`/`original_scope_reference` fields, especially by supplying
a trivial or empty `brief` of their own so the "existing milestones"
context dominates what the AI has to talk about.

## The fix

Added the same `user_has_project_access` RPC check every other
project-scoped Edge Function in this codebase already uses
(`create-video-room`, `mint-video-token`, `studio-ingest`, `desk-agent`)
— called immediately after JWT verification and before any project
data is touched:

```ts
const { data: hasAccess } = await supabase.rpc('user_has_project_access', {
  project_id_param: projectId,
  user_id_param: user.id,
});
if (!hasAccess) {
  return new Response(JSON.stringify({ error: 'You do not have access to this project' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

Placed before the `projects`/`milestones` selects, so a rejected caller
never causes either query to run — not just a response that happens to
withhold the result.

**Frontend needs no changes.** `ScopeGuardian.tsx`'s `callScopeGuardian`
already handles any non-2xx response by parsing `err.error` and showing
a toast (`resp.ok` check, lines 102–105 of that file) — the new 403
surfaces as a clean "Analysis failed: You do not have access to this
project" message, which no legitimate caller will ever see since
`projectId` always comes from the page's own route param, never
user-supplied.

## A correction to the original audit, caught before touching anything

`STUDIO_CURRENT_STATE_AUDIT.md`'s finding 3 also named `verify-credit`
as sharing the same pattern, citing this repo's own pre-existing
`AI_AUTOMATION_AUDIT.md:346–363`. Reading `verify-credit/index.ts`
directly (not just trusting either audit document) before touching it
found that citation is **stale** — the function already re-derives
`project_name`/`role`/`year`/`platform` from the credit's own DB row and
explicitly checks `credit.user_id !== user.id` → 403 (lines 47–68 of
the current file, with an in-code comment describing the exact fix).
Someone — likely the parallel Lovable session — already closed this one
after `AI_AUTOMATION_AUDIT.md` was written. **No change was made to
`verify-credit`.** This is exactly the "verify against the current
code, not a document" discipline this whole audit chain has been built
on — including checking claims made by *my own* earlier report, not
just the Feature Bible's.

## Verification

- Typecheck, test, build: run and clean (this is Deno Edge Function
  code, outside `tsc`'s project scope, so typecheck doesn't directly
  cover it — verified separately with a brace-balance parse of the
  edited file, same technique used for every other Edge Function change
  this session where Deno wasn't available locally).
- **Not verified**: no real HTTP request was made against a live
  `scope-guardian` deployment (test or otherwise) confirming the 403
  actually fires for a cross-account request — this function has not
  been deployed. Per this engagement's standing rule, deployment is a
  manual step for the user, not performed by this session.

## What would close this out

1. User deploys the updated `scope-guardian` function via Lovable
   Cloud.
2. Real client-path negative test, same style as every other negative
   test this session: two real test identities, one with a project, one
   without any relationship to it. The second identity calls
   `scope-guardian` with the first's real `projectId` and a
   `check_scope_drift`/`analyze_brief` action; expect `403` with
   `{"error":"You do not have access to this project"}`, not a 200
   response referencing the victim's real brief or milestone amounts.
3. Positive-path re-test with the real owner's identity, confirming the
   function still works normally post-fix (no regression for the
   legitimate case).

None of these three have been run. This report documents a prepared,
verified-to-compile fix — not a verified-to-work-in-production one.
