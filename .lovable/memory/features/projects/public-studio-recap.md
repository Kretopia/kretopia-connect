---
name: Public Studio Recap
description: IMDb-style public Studio recap page at /studio/:token. Adds recap_token/recap_published/recap_summary on projects. RPC get_public_studio_recap bundles owner+crew+milestones+approved deliverables. PublishRecapDialog surfaces from WrapProjectCard after a project is wrapped.
type: feature
---

# Public Studio Recap

After a Studio is wrapped, the owner can publish a public IMDb-style recap of the project.

## Schema (on `public.projects`)
- `recap_token text UNIQUE` — auto-assigned via `trg_assign_project_recap_token` trigger (and backfilled).
- `recap_published boolean default false` — gates public visibility.
- `recap_summary text` — optional pitch paragraph shown on the recap.

RLS adds an extra SELECT policy: anyone (anon + authenticated) can read a row when `recap_published = true`. `anon` was granted SELECT on `projects` for this.

## RPC
`get_public_studio_recap(token text) returns jsonb` — SECURITY DEFINER, returns NULL when the recap isn't published. Bundles project + owner + accepted collaborators + milestones + deliverables in status `approved|final|completed`.

## UI
- Route: `/studio/:token` → `src/pages/StudioRecap.tsx`. Mood-gradient hero, crew roll-call, what-shipped grid (uses deliverable moodboard first thumb), milestones timeline, footer CTA to start a Studio.
- `PublishRecapDialog` (`src/components/project/studio/PublishRecapDialog.tsx`) — toggle published, edit summary, copy link.
- `WrapProjectCard` — when project status is `completed|archived`, it now renders the Publish recap CTA instead of returning null.

## Conventions
- Crew links route to `/@:username` when a username exists.
- Deliverables without a moodboard fall back to the project's mood gradient.
- Summary falls back to `project.description`; both feed `og:description`.
