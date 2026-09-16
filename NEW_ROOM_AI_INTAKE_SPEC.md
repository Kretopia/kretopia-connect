# New Room — AI Intake Spec

Real, current behavior of `supabase/functions/extract-brief/index.ts` (fixed this pass — see `NEW_ROOM_RELEASE_GATE.md`). Not aspirational.

## Contract

Input: `{ source: "text"|"csv"|"sheet"|"doc"|"audio", workspace_type, ...source-specific fields }`. Output, always: `{ project: { title, summary }, deliverables: [{ title, description, due_date, references[], notes }] }`.

## Model

`google/gemini-2.5-flash` via the Lovable AI gateway, `response_format: json_object`. One request per call, no streaming, no chain-of-thought exposed (there isn't one to expose — a single structured-output call).

## Persona system (fixed this pass)

Keyed on the real 11-value `WorkspaceType` enum from `src/lib/workspaceConfigs.ts` (`photo_shoot, video_shoot, music_project, fashion_show, event_production, commissioned_art, brand_collab, dj_live_gig, edit_job, content_series, general`), each with a `{ role, lens, example }` persona used to build the system prompt. `podcast`/`client` kept as extra recognized aliases (podcast folds into `content_series`, per that type's own "Podcast, YouTube series, IG/TikTok content" description). Whitelist is derived from `Object.keys(PERSONAS)` directly, so it can't drift out of sync with itself again the way it drifted from the app's real enum before.

**Known duplication risk, not fixed this pass**: `workspaceConfigs.ts` also defines its own `aiPersonaPrompt` per type (a shorter blurb for the in-Studio "Project Copilot" context, a different purpose/shape than `extract-brief`'s richer role/lens/example). These are two separate hand-maintained persona systems now correctly covering the same 11 types, but not sharing a single source of truth — a Deno edge function can't import from the Vite app's `src/lib/`. Flagged for whoever next touches either one.

## Sources

- `text`/`csv` — passed straight through as the user's raw content.
- `sheet` — public Google Sheet CSV export endpoint, no OAuth, requires "Anyone with the link — Viewer" sharing.
- `doc`/`audio` — base64 multimodal parts sent directly to Gemini; no separate OCR/transcription service, no server-side persistent storage (files never touch Supabase Storage).

## Auth

Requires a valid Supabase JWT (`Authorization: Bearer <token>`, verified via `supabaseAuth.auth.getUser(token)`) — fixed in an earlier pass per a comment in the function referencing a prior unauthenticated-abuse finding; still correctly in place, unchanged this pass.

## Not implemented (confirmed absent, not claimed anywhere in the UI)

Server-side file-size/MIME enforcement (client-side 25MB cap only), rate limiting beyond the AI gateway's own 429 response, response caching/dedup for repeated identical requests.
