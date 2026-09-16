# Kreto New Room Integration Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED`

Supersedes the read-only version of this report. Implementation matches the recommendation exactly: `KretoPresence` (`card` size in `prompt`/`recording`/`thinking`/`error`, `compact` in `review`) replaces the old flat `KretoMark size="xl" state="active"` that previously only appeared in `thinking` mode, and follows real `mode` across all five other modes too.

## What changed, by file

- **`src/components/brand/KretoPresence.tsx`**: added `listening` as a 9th real state (`KRETO_STATE_MACHINE_REPORT.md`'s original 8 plus this one) with its own calm, steady pulse (`loop-listen`, 2s) — deliberately gentler than `processing`'s pulse so it doesn't compete with New Room's own large pulsing stop-button that's already on screen during recording.
- **`src/lib/newRoomCaution.ts`** (new): pure, independently-tested function computing the real caution reasons — extracted the same way `inferWorkspaceType.ts` already was in this codebase, for the same reason (testable in isolation, not buried in the modal).
- **`src/components/project/studio/VoiceFirstCreateModal.tsx`**: added `"error"` as a 5th real `Mode`; added `composerFocused`, `isOffline`, `errorInfo`, `creationError`, `draftDegraded` state, each tied to a real signal (DOM focus, the browser's `online`/`offline` events, and the real catch blocks respectively); replaced the old `KretoMark` in `thinking` with `KretoPresence`; added `KretoPresence` to `prompt`, `recording`, the new `error` screen, and `review`.
- **`src/components/project/studio/StudioCreatedAcknowledgement.tsx`** (new): the one-time Studio-side acknowledgement, mounted in `src/pages/ThriveDesk.tsx` alongside the existing `AgentModeBanner`/`ProjectInviteAcceptBanner` banners.

## Placement verification (against the concerns raised in the read-only pass)

- **`prompt`**: `KretoPresence` sits above the "What are you making?" heading, in-flow, `mb-4` — does not overlap the composer, chips, or the file/link buttons below. Confirmed live.
- **`recording`**: sits above the existing 112px pulsing stop-button with its own margin (`mb-5`) — does not overlap it.
- **`thinking`**: direct swap for the prior `KretoMark`, same position.
- **`error`** (new): a dedicated, centered screen — does not need to avoid anything else since it's the only content on screen in that mode.
- **`review`**: placed inline to the left of the existing "Kreto structured your project — review and edit" line, `compact` size — does not push the form down meaningfully or cover the title/summary fields, checklist, or footer Create buttons. The caution-reasons banner (when present) and the creation-error banner (when present) render between that header and the title field, above everything else — never inside or over the scrollable form, never over the fixed footer.

## What did NOT change

- No route changed. No auth/RLS/payment logic changed — `createProject()`'s actual `supabase.from("projects").insert(...)` call, its columns, and its success/failure branching are untouched; the only addition is `state: { kretoJustCreated: true }` on the pre-existing `navigate()` call.
- No new network request was added anywhere — every new state derives from data/events the modal already had or from the browser's own connectivity events.
- `creatingRef`'s existing double-submit guard is untouched and still the thing preventing duplicate Studio creation (re-verified: the pre-existing "creates exactly one project even if Create is double-clicked" test still passes unmodified).

## Verification

Same evidence as `KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md`: `tsc`, `eslint`, `npm run build`, `vitest run` (19+6+4 tests across the three touched/new test files), plus the live browser walkthrough of the full real intake → review → create → Studio-acknowledgement → refresh-no-repeat flow.
