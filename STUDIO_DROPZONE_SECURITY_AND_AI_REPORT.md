# Drop Zone Security + AI Authorization

Covers Phase 2 work against audit security risks #1 (`elevate-brief`/
`extract-brief` had no auth), #2 (Drop Zone auto-applied AI output with
no review), and #3 (`thrive-ai-chat`'s service-role read of
`studio_facts`/`studio_entities` bypassed their own RLS).

## Risk #2 — Drop Zone review gate

[`src/components/project/studio/BriefDropZone.tsx`](src/components/project/studio/BriefDropZone.tsx)
previously wrote `elevate-brief`'s output straight to the database the
moment the Edge Function returned: `projects.description`,
`project_tasks`, `project_deliverables`, `project_run_of_show`,
`event_suppliers`, `event_talent`, and a `project_notes` row — all
inside `ingestFile()`, no confirmation step.

**Fix**: that entire write block moved into a new `applyElevation()`
function, only called from an explicit "Add to Project" button.
`ingestFile()` now stages the same data in `pendingElevation` state and
returns; a new render branch (checked before the old `summary` panel)
shows the proposed brief title/summary and per-category counts (Tasks →
Studio feed, Deliverables → Vault, etc. — same visual pattern as the
existing post-ingest summary panel, for consistency) with "Add to
Project" and "Discard" buttons. Nothing in the forbidden list is
written until "Add to Project" is clicked.

**Deliberately NOT gated**: the `studio-ingest` call (writes
`studio_facts`/`studio_entities` — the "Studio Brain" memory) and the
Vault file upload (`project_files` + storage). These aren't in the
spec's forbidden-to-auto-apply list, and are reasonably read as the
spec's own allowed "Kreto may... classify uploaded material" — passive
memory, not a change to the Brief/Tasks/Deliverables/Moodboard/
Milestones a collaborator would see as "their" project data changing
under them.

**Not browser-verified**: `BriefDropZone` is owner-gated
(`if (!isOwner) return null;`) and this session's test account isn't
the owner of its one available Project (confirmed via direct REST
query — see implementation report §0's discovery method). Verified by
full code read instead: traced every `.insert()`/`.update()` call from
the old inline block into the new `applyElevation()`, confirmed the
row-shaping logic (`offsetToISODate`, field mapping, `.slice()` caps) is
byte-for-byte the same, just relocated and gated.

## Branding fix

`BriefDropZone.tsx` headline: `"Land it here — Thrive files it"` →
`"Feed the Kretopia Brain"`, subtext updated to the spec's suggested
copy. Same fix applied to `StudioPulseFeed.tsx` (`"Land it here —
Copilot files it"`) for consistency, even though that component is
currently unmounted/unreferenced anywhere in the app (confirmed via
grep) — cheap to fix now rather than leave a second copy of the same
bug dormant for whenever it's re-linked.

## Risk #1 — `extract-brief` / `elevate-brief` had no auth

Both Edge Functions accepted requests from anyone holding the public
anon key, with zero authentication. Added the same JWT-verification
pattern already used elsewhere in this codebase (`scope-guardian`,
`desk-agent`): read the `Authorization` header, call
`supabase.auth.getUser(token)` against an anon-key client, reject with
`401` if it fails. Real risk was moderate, not severe — neither function
persists anything itself (frontend does all writes after review), so
this is primarily a cost/abuse control (stopping free, off-platform use
of Kreto's AI drafting) rather than a data-exposure fix. The Supabase
JS client already attaches the caller's session token automatically on
`functions.invoke()`, so no frontend change was needed for this to work
once deployed.

## Risk #3 — `thrive-ai-chat`'s Studio Brain read bypassed RLS

`studio_facts`/`studio_entities` both have correctly-scoped RLS
policies (project owner or accepted collaborator only) — confirmed by
reading the migration that created them
(`20260605211554_9d991fd7-...sql`). But `thrive-ai-chat/index.ts` reads
them with a **service-role** client (`admin.from("studio_facts")...`),
which bypasses RLS entirely, using a `project_id` taken directly from
the client-supplied `surface_context` in the request body — an
authenticated user could set `surface_context.project_id` to any
project UUID and have those facts/entities loaded into Kreto's context
for that request.

**Fix**: added a `user_has_project_access` RPC check (same RPC every
other project-scoped function in this codebase already uses) gating the
fetch — added `hasProjectAccess` computed before the `Promise.all`, and
required for the block to run at all.

## Deployment status

All three Edge Function changes are **prepared, not deployed** —
verified to parse (Node brace-balance check, since there's no local
`deno check`) but Edge Function deployment is this engagement's
standing manual step for the user, not something this session performs
directly. None of the three has a live negative test run against it
yet (e.g., a second real account confirming `extract-brief` now 401s
without a token, or that `thrive-ai-chat` no longer echoes another
project's facts).

## What would close this out

1. Deploy `extract-brief`, `elevate-brief`, `thrive-ai-chat`.
2. Real client-path negative test: call `extract-brief` with no
   Authorization header — expect `401`, not a 200 with AI output.
3. Real client-path negative test: two real accounts, one with a
   Project, one without any relationship to it — the second account's
   Kreto chat, primed with `surface_context.project_id` set to the
   first account's project, should get no Studio Brain facts/entities
   in its context.
4. Positive-path re-test: a legitimate project owner's Kreto chat still
   surfaces their own project's facts/entities correctly post-fix.

None of these four have been run.
