# Event Image Upload — Security Report

## Status: `AUDITED`. No changes made — the path is already correctly secured.

## Scope

`src/components/sessions/EventCoverPicker.tsx` (picker/cropper) → `src/components/sessions/CreateSessionDialog.tsx:199-207` (`uploadCover()`) → Supabase Storage `portfolio` bucket.

## Findings

| Control | Status | Evidence |
|---|---|---|
| Client-side MIME allowlist | `AUDITED` — present | `EventCoverPicker.tsx:68,77-81`: `["image/jpeg","image/png","image/webp","image/gif"]`, SVG explicitly excluded with a comment explaining why (embedded scripts) |
| Client-side size limit | `AUDITED` — present | `EventCoverPicker.tsx:82-86`: 5MB |
| Server-side MIME allowlist | `AUDITED` — present | `supabase/migrations/20250930081656_...sql:1-9`: bucket-level `allowed_mime_types` — enforced independent of the client |
| Server-side size limit | `AUDITED` — present | Same migration: bucket-level `file_size_limit`, later raised (`20251213113954_...sql`) |
| Upload path scoping | `AUDITED` — correct | `CreateSessionDialog.tsx:201-203`: `${user.id}/events/{timestamp}.{ext}` |
| Storage RLS — INSERT/UPDATE/DELETE | `AUDITED` — correct | `20251008100854_...sql:5-12`: `(storage.foldername(name))[1] = auth.uid()::text`, independently re-verified server-side, not spoofable via a client-supplied path |
| Storage RLS — SELECT | `AUDITED` — correct | Public read (`bucket_id = 'portfolio'`) — appropriate, these back public event pages |
| Path traversal | `AUDITED` — not possible | Filename is always machine-generated (`event-cover-{Date.now()}.jpg` from the cropper, `EventCoverPicker.tsx:100`), original filename/extension never trusted |
| Old cover cleanup on replace | `AUDITED` — gap found, not fixed | `removeCover()` (`EventCoverPicker.tsx:151-153`) clears local state only; the previous Storage object is never deleted. Storage-hygiene issue, not a security issue — `DEFERRED_AFTER_DEADLINE` |

## Verdict

No `REQUIRES_MIGRATION_APPROVAL` needed for this surface. The combination of client-side validation (fast feedback) and independently-enforced server-side MIME/size/path RLS (the actual security boundary) was already correctly built in a prior pass and remains correct today.
