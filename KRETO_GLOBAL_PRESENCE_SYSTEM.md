# Kreto Global Embodied Presence System

Index/overview report. Read this first; each linked report carries the detail and the per-item status table for its area.

## What this is

`KretoPresence` (`src/components/brand/KretoPresence.tsx`) is Kreto's embodied visual presence: a layered-SVG + Framer Motion mark with a caller-driven state model, built to the character rules in `Kretopia_Kreto_Evolution_Brief_v1.docx` and the rights posture in `KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md`. This report set formalizes that pilot into the global system the current brief specifies: a 9-item state model, a 5-item size model, an explicit surface placement map, and phase-gated rollout.

## Current phase status

| Phase | Surfaces | Status |
|---|---|---|
| A — Pilot | Kreto launcher, Landing Hero, Studio (`KretoTip`) | Live. Re-verified against the expanded state/size model in this pass — see `KRETO_PILOT_VERIFICATION_REPORT.md`. |
| B — First expansion | Scout, New Room, Passport/Credits | Scout and Passport live (idle-only, via `KretoTip`). New Room (`VoiceFirstCreateModal`) not started — it is the one surface with real listening/processing/draft-ready state to map honestly, so it needs its own implementation pass, not a `KretoTip` drop-in. See `KRETO_ROLLOUT_PHASE_B_REPORT.md`. |
| C — Selective contextual expansion | Events, Stage, Recordings, Messages empty states | Events and Stage/Circle live. Recordings has `KretoTip` mounted but not enrolled in the presence rollout (one-line, low-risk addition when approved). Messages has no Kreto presence at all yet. See `KRETO_ROLLOUT_PHASE_C_REPORT.md`. |
| D — Micro-mark only | KrePay, minor dashboards, passive surfaces | KrePay already correctly renders flat `KretoMark` only (verified, not the embodied presence) via the same `KretoTip` route-group mechanism that keeps every non-enrolled surface flat. No dedicated Phase D work item exists yet. |

## Reports in this set

- `KRETO_ORIGINALITY_AND_REFERENCE_REPORT.md` — rights/originality, carried forward from the pilot audit.
- `KRETO_STATE_MACHINE_REPORT.md` — the full 9-state global model, what triggers each, and two explicit design decisions (`reduced_motion` is not a state value; `attentive` is component-internal, not caller-supplied).
- `KRETO_SURFACE_PLACEMENT_MAP.md` — the full §4 surface rulebook with actual current status per surface.
- `KRETO_PILOT_VERIFICATION_REPORT.md` — Phase A re-verified against the new model.
- `KRETO_ROLLOUT_PHASE_B_REPORT.md`, `KRETO_ROLLOUT_PHASE_C_REPORT.md` — per-surface status against Phase B/C's own surface list.
- `KRETO_PERFORMANCE_BUDGET_REPORT.md`, `KRETO_ACCESSIBILITY_REPORT.md`, `KRETO_PRIVACY_AND_TRUST_REPORT.md` — cross-cutting verification.
- `KRETO_GLOBAL_RELEASE_GATE.md` — the roll-up gate and the final status.

## Final status for this pass

See `KRETO_GLOBAL_RELEASE_GATE.md`. Short version: the state/size model expansion is implemented, typechecked, unit-tested, and browser-spot-checked; it does not regress anything live. Full global rollout is not complete — New Room, Recordings enrollment, and Messages remain, each requiring its own explicit approval per the phase-gate process this brief defines.
