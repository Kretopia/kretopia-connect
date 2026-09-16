# New Room — Studio Initialization

## Real, type-aware — not generic

`createProject()` → `projects` insert (real `workspace_type` column) → optional `project_tasks` seed for selected deliverables → `scaffoldProjectDefaults()` (`src/lib/scaffoldProject.ts`), which reads `WORKSPACE_CONFIGS[workspaceType]` (`src/lib/workspaceConfigs.ts`, the same config the Studio room's own tabs use) and idempotently seeds:
- **Vault folders** — genuinely different per type (`photo_shoot`: Call Sheet/References/Shot List/Raw/Selects/Final Retouched; `music_project`: Stems/Sessions/Masters/Artwork/Splits/Press Kit; `general`: References/Drafts/Final; 8 more, each distinct).
- **Starter deliverables** — same pattern, e.g. `dj_live_gig`: "Confirm set time & rider," "Build setlist," "Confirm payment," "Upload recap clips."

"Idempotent-ish" per the file's own comment: skips folders/tasks whose (case-insensitive, whitespace-normalized) name already exists, so a partial retry doesn't duplicate them.

## Visible, editable, reversible

The room-type picker on the review screen lets the user override the inferred type before creation; `WORKSPACE_CONFIGS` is a real, readable module (not a black box), and the seeded folders/tasks are ordinary rows the user can rename/delete once inside the room — nothing about the scaffold is locked in.

## If uncertain

Falls back to `general` (a real, defined config with its own generic-but-real Vault folders and deliverables) rather than a broken/empty state.

## Not changed this pass

`scaffoldProject.ts` and `workspaceConfigs.ts` were read, not touched — the audit found this piece already correct and load-bearing (flagged as "files to protect" in `NEW_ROOM_UX_AUDIT.md` §10).
