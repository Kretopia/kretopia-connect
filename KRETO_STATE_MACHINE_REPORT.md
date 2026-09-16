# Kreto State Machine Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`

`src/components/brand/KretoPresence.tsx` implements the global state model. `KretoPresenceState` is now `"idle" | "attentive" | "processing" | "proposal_ready" | "success" | "caution" | "error" | "offline"` — 8 values. The brief lists a 9th, `reduced_motion`; see the design decision below for why it is not a 9th enum value.

## Mapping table

| State | Real trigger (caller's responsibility) | Visual | Motion | Color | Text announcement |
|---|---|---|---|---|---|
| `idle` | No active request. Default. | Slow breathing (translate/scale) | Loop, 11s | `--energy` | None (nothing to announce) |
| `attentive` | Real hover/focus on an interactive `KretoPresence` — **tracked internally**, not caller-supplied | Slight tilt/scale nudge | One-shot, 0.4s | `--energy` | None (the control's own `aria-label` already covers it) |
| `processing` | A real pending request/transcription/prepare step | Fast signal pulse | Loop, 1.3s | `--energy` | "Kreto is working on this" |
| `proposal_ready` | A real proposal card is rendered, needs approval | Signal fades/scales in once | One-shot | `--energy` | "Kreto has a suggestion ready" |
| `success` | Backend/system confirms a real completed action | Signal gives one small nod | One-shot | `--energy` | "Kreto completed the action" |
| `caution` | Approval needed / a decision has impact / review a draft | Static, calm | None | `--warning` (existing token, both Day and Night) | "Kreto needs you to review something before it continues" |
| `error` | A real error | Static, quiet | None | `--muted-foreground` (never red, never flashing) | "Kreto needs your attention" |
| `offline` | A real connectivity/availability failure | Static, quiet | None | `--muted-foreground` | "Kreto is unavailable right now" |

Every non-empty label above renders as real `sr-only` text — never color or motion alone — per §8. Confirmed by `KretoPresence.test.tsx`'s `it.each` over all six non-empty states.

## Design decision: `reduced_motion` is not a state enum value

The brief's §2 list conflates two different axes: **what Kreto is actually doing** (idle/attentive/processing/...) and **how it's allowed to move** (reduced motion or not). These are orthogonal — a real `processing` request can happen while the user has `prefers-reduced-motion: reduce` set, and the correct behavior is "still processing, just render it statically," not "pretend nothing is happening." Folding `reduced_motion` into the same enum as `state` would make that combination unrepresentable (a caller would have to choose between reporting the true state or reporting the motion preference, not both).

Instead, motion preference is handled exactly as the pilot already did: `useReducedMotion()` (a live `prefers-reduced-motion` media-query hook, already used app-wide) gates every `animate` prop in the component to `undefined` regardless of `state`. The `sr-only` text announcement is unaffected by motion preference — the real state is always in text, whether or not it's animated. See `KretoPresence.test.tsx`'s "does not throw and renders statically under prefers-reduced-motion" test, extended in this pass to cover the new states through the same code path (the gating is applied once, before the per-state branches, so it does not need per-state test duplication).

## Design decision: `attentive` is component-internal, not caller-supplied

Every other state is a claim about the outside world that only the caller can know is true (is a request really pending? did the backend really confirm success?). Hover/focus is different: it is a real, verifiable DOM fact the component can observe on its own interactive button. Making it caller-supplied would invite exactly the failure mode the whole brief is designed to prevent — a caller setting `state="attentive"` on a hunch, unable to prove it's true. Instead, `KretoPresence` tracks its own `hovered` boolean via `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` on its own button, and only displays it when the *caller's* real state is `idle` — hovering a control that is genuinely `processing`, `caution`, etc. keeps showing that real state. Covered by two tests: attentive-on-hover-while-idle, and processing-stays-processing-while-hovered.

## `offline` — implemented, not yet wired anywhere

No surface in this codebase currently tracks connectivity (`grep -rn "navigator.onLine"` across `src/` returns nothing). The component supports `offline` truthfully — a caller with a real connectivity/availability signal can pass it — but nothing does yet, and this pass does not add a speculative `navigator.onLine` listener to any pilot surface, since no approved surface currently has a genuine "Kreto backend unavailable" concept distinct from a normal request error. Flagged here so a future integration doesn't need to touch this component to use it, and so nobody wires a synthetic/guessed offline signal without a real one to point at.

## `full` size — implemented, not yet used

See `KRETO_SURFACE_PLACEMENT_MAP.md` and `KRETO_PERFORMANCE_BUDGET_REPORT.md` for the sizing and lazy-load status.
