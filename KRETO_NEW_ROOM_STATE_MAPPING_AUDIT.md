# Kreto New Room State Mapping Audit

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED`

Supersedes the read-only version of this report. All approved product decisions (caution/success/error) are now implemented in `VoiceFirstCreateModal.tsx`, `StudioCreatedAcknowledgement.tsx`, and `src/lib/newRoomCaution.ts`.

## Final mapping table (as built)

| State | Real trigger | Where |
|---|---|---|
| `idle` | `mode === "prompt"`, online, composer not focused | `VoiceFirstCreateModal.tsx` |
| `attentive` | `mode === "prompt"` and the composer is genuinely focused (real `onFocus`/`onBlur`), or the link form is open | `VoiceFirstCreateModal.tsx` |
| `listening` | `mode === "recording"` — only reachable after `getUserMedia({audio:true})` resolves; a denial never reaches it | `VoiceFirstCreateModal.tsx` |
| `processing` | `mode === "thinking"` — covers all four real intake paths (voice, text, file, link) | `VoiceFirstCreateModal.tsx` |
| `caution` | `mode === "review"` and either (a) the draft degraded to a raw, unstructured fallback because extraction genuinely failed non-fatally, or (b) the project type couldn't be confidently inferred (`workspaceType === "general"`) | `VoiceFirstCreateModal.tsx` via `getNewRoomCautionReasons()` (`src/lib/newRoomCaution.ts`) |
| `proposal_ready` | `mode === "review"`, no caution reasons apply | `VoiceFirstCreateModal.tsx` |
| `error` | A real hard failure in voice/file/link extraction (own full-screen state, retains input, offers retry), or a real `createProject()` failure (inline banner within the still-editable review form) | `VoiceFirstCreateModal.tsx` |
| `offline` | The browser's own `online`/`offline` events, tracked only while New Room is open | `VoiceFirstCreateModal.tsx` |
| `success` | A one-time acknowledgement on `/desk/:projectId`, shown only when the real `navigate()` call from a confirmed `createProject()` success included `state: { kretoJustCreated: true }` | `StudioCreatedAcknowledgement.tsx` |

## Approved decisions, as implemented

- **Caution**: deliberately excludes "no deliverables extracted" from the reusable reason list, since that case already has its own dedicated inline message where the checklist would be (`"We couldn't pull starter tasks from that..."`) — showing both would repeat the same idea twice. The `caution` *visual state* still activates for that case; only the extra prose banner is skipped, per `KretoTip`-adjacent precedent of not duplicating existing real copy.
- **Success**: New Room's modal is unchanged in its closing behavior — no artificial delay, no fake animation added to it. The one-time acknowledgement lives on the Studio route (`ThriveDesk.tsx`, via `StudioCreatedAcknowledgement`), gated on real React Router navigation `state` (not a query param, so it can't be bookmarked, shared, or hand-typed) set only inside the real `createProject()` success path.
- **Error**: implemented as two distinct, calm, static (no flashing) presentations — a full-screen retry state for hard intake failures (voice/file/link, where no draft exists yet to preserve beyond the raw input, which is left untouched) and an inline banner within the still-fully-editable review form for a creation failure (where the whole draft must be preserved, and is).

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npx eslint` on every changed/new file — clean (pre-existing, unrelated `any` findings in both files confirmed via `git diff` to predate this change).
- `npx vitest run` — 19/19 in `VoiceFirstCreateModal.test.tsx` (10 new, covering idle/attentive/listening/denied-mic/processing/proposal_ready/caution×2/error/success-route-state), 6/6 in `StudioCreatedAcknowledgement.test.tsx`, 4/4 in `newRoomCaution.test.ts`.
- `npm run build` — clean; `VoiceFirstCreateModal` chunk +2.8 KB, `ThriveDesk` chunk +1 KB — no new dependency.
- **Live browser verification** (desktop, authenticated session): opened New Room via Studio's quick actions, typed a real photo-shoot brief, submitted it — the real `extract-brief` edge function returned a genuine structured draft ("Tropical Sands Swimwear Collection Shoot", 7 real tasks), correctly showing `proposal_ready` with no caution banner (clean, confidently-typed draft). Answered the payments gate, clicked "Create all & open" — a real project was created, the app navigated to `/desk/:projectId`, and the "Your Studio is ready." acknowledgement appeared with the `success` presence. Refreshed the same URL directly: the acknowledgement correctly did **not** reappear. No console errors attributable to this change (the 404/400s present are the pre-existing, already-documented Lovable asset-proxy non-bug).
