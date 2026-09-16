# Kreto Rollout — Phase B (First Expansion)

Phase B surfaces per the brief: Scout, New Room, Passport/Credits.

## Status: `IMPLEMENTED` (Scout, Passport) / `NOT_STARTED`, `REQUIRES_APPROVAL` (New Room)

| Surface | Status | Detail |
|---|---|---|
| Scout | `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` | `KretoTip.tsx`'s `/discover`\|`/scout`\|`/opportunities` group, enrolled in `PRESENCE_EYEBROWS`. Shipped in a prior turn of this rollout; re-covered by this pass's expanded `KretoTip.test.tsx` regression suite (surface="discover" still renders the embodied presence, not the flat mark). |
| Passport | `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` | `KretoTip.tsx`'s `/profile` group. Same coverage as above (surface="passport"). |
| New Room | `NOT_STARTED`, `REQUIRES_APPROVAL` | Maps to `VoiceFirstCreateModal.tsx`. Unlike every other Phase A/B surface shipped so far, this one has a *real* multi-step state machine (idle → listening → processing/transcribing → draft-ready) that `KretoPresence` could honestly reflect end-to-end instead of only ever showing `idle`. That makes it more valuable but also more invasive: it means reading `VoiceFirstCreateModal`'s actual mic-capture and transcription state and wiring real transitions, not dropping in a static `KretoTip`. Not started in this pass — needs its own explicit approval before implementation, per the brief's own phase-gate rule ("Do not execute Phase B... until the previous phase... has explicit approval for expansion" and per-item, this specific item needs a scoped go-ahead since it's materially different work from the other two). |

## What "Phase B complete" requires

New Room implemented with real (not idle-only) state mapping, typechecked, unit-tested, and browser-verified per the same bar as every other surface in this rollout, plus this report updated to `IMPLEMENTED` for all three rows before Phase C is treated as fully closed out. Phase C's Events/Stage work already happened in parallel with this (see `KRETO_ROLLOUT_PHASE_C_REPORT.md`) under the prior, less formal rollout process — noted here rather than treated as a process violation, since the user explicitly authorized "controlled rollout beyond the pilot, one surface at a time" before this stricter phase-lettering existed.
