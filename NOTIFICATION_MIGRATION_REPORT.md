# Notification Migration Report

Project: Kretopia · Lovable Cloud · ref `kwmcocsitwssrtzkdojh`
Date: 2026-08-23

## Pre-migration inspection (APPLIED = no)
- `public.notifications` had **no** dedupe column and no unique index. Columns:
  `id, user_id, type, title, message, read, link, created_at, action_url, action_text, image_url, priority, category`.
- `public.applications` had **no** link to a created Studio/project.
- `public.projects` had no `source_application_id`.
- Existing duplicate scan: `0` duplicate `opportunity` notifications (same user + type + action_url).
  → **No cleanup required. No existing notification rows were deleted or modified.**
- Accepted applications at migration time: `3` (all pre-date the Studio link; `studio_project_id` is NULL for them —
  accepting them again will create their Studio once and then stay idempotent).

## Migration applied (APPLIED = yes)
```sql
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS studio_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.accept_application_and_create_studio(_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;

REVOKE ALL ON FUNCTION public.accept_application_and_create_studio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_application_and_create_studio(uuid) TO authenticated;
```
Partial unique index (`WHERE dedupe_key IS NOT NULL`) is backward compatible: every legacy row has
`dedupe_key = NULL` and is therefore unconstrained.

## Dedupe key
`studio-created:{studio_id}:applicant:{applicant_id}` — deterministic, written by the RPC with
`ON CONFLICT (dedupe_key) DO NOTHING`.

## Post-migration verification (APPLIED + verified against live DB)
| Check | Result |
|---|---|
| `notifications_dedupe_key_uidx` exists | yes |
| RPC exists | yes |
| `anon` can execute RPC | **false** |
| `authenticated` can execute RPC | true |
| RLS on `notifications` | enabled |
| Legacy notification rows altered | none |

## Rollback
```sql
DROP FUNCTION IF EXISTS public.accept_application_and_create_studio(uuid);
DROP INDEX IF EXISTS public.notifications_dedupe_key_uidx;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS dedupe_key;
ALTER TABLE public.applications DROP COLUMN IF EXISTS studio_project_id;
```
Non-destructive to existing data.
