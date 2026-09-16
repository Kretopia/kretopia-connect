# New Room — Draft Contract

## Shape

`ExtractedBrief` (`VoiceFirstCreateModal.tsx`): `{ project: { title, summary }, deliverables?: [{ title, description?, due_date? }] }` — a subset of `extract-brief`'s full `BriefOut` (which also carries `references[]`/`notes` per deliverable; the modal's review UI doesn't currently surface those two fields, so they're silently dropped between the edge function's response and the review screen — not a bug, just unused surface today).

## Review-screen fields (all genuinely editable, confirmed by reading the state bindings, not just the labels)

Project name (bound to `brief.project.title`), "The vision" (bound to `brief.project.summary`), starter-task checklist (select-all/clear-all, bound to a `Set<number>` of selected deliverable indices), room-type pill picker (`workspaceType`, any of the 11 real types), money-involved Yes/No gate (`paymentsInvolved`), track-as-credit checkbox (`trackAsCredit`), target date and budget text fields.

## What's fabricated vs. real

Nothing fabricated. Every field on the review screen maps to real component state that flows into the real `createProject()` insert. No field is decorative or unwired.

## Provenance

Not persisted as a distinct field on the `projects` row — the draft's source (voice/text/file/link) isn't written to the database once a project is created, only used transiently during the review step. If a future pass wants "how was this project drafted" visible after creation, that's a real schema addition, not something this pass added.

## Incomplete input / fallback to General

Confirmed: if `extract-brief` returns without a usable `project.title` (or errors), the modal builds a minimal brief directly from the raw input (`{ title: trimmed.slice(0, 60), summary: trimmed }`) and still reaches `review` with `workspaceType` left at whatever was inferred/selected (defaulting to `general` if nothing matched) — never dead-ends the user, matches the spec's "fallback to General" requirement.
