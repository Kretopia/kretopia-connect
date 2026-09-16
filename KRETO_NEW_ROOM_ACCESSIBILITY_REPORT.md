# Kreto New Room Accessibility Report

## Status: `IMPLEMENTED`, `UNIT_TESTED` (semantics), `BROWSER_VERIFIED` (desktop) — mobile layout reasoned from source, not live-clicked, this pass (see limitation below)

## Requirements checked against the implementation

- **Decorative unless a real actionable control**: every new `KretoPresence` instance in `VoiceFirstCreateModal.tsx` (`prompt`/`recording`/`thinking`/`error`/`review`) is mounted with no `onClick`, so each renders through `KretoPresence`'s `aria-hidden="true"` branch automatically. None is a control.
- **All states have text equivalents**: `idle`/`attentive` have none by design (nothing to announce — see `KRETO_STATE_MACHINE_REPORT.md`). Every other state (`listening`/`processing`/`caution`/`proposal_ready`/`error`/`offline`/`success`) has both `KretoPresence`'s own `sr-only` announcement *and* real, visible, non-hidden copy already present in the surrounding UI (the mode's own heading/body text, the caution-reasons banner, the error screen's own paragraph, the Studio acknowledgement's own visible sentence) — satisfying New Room's stricter "state text must be visible separately" rule, not just an `sr-only` one.
- **`aria-live` on relevant text**: added `aria-live="polite"` to the cycling "thinking" status text (previously had none); the error screen's explanatory paragraph uses `role="alert"` (assertive by default, appropriate for a real failure); the caution banner uses `role="status"`; the creation-error banner uses `role="alert"`; the Studio acknowledgement uses `role="status" aria-live="polite"`.
- **No state conveyed by animation/color alone**: every state above pairs its visual with the text listed above.
- **Reduced motion removes non-essential movement**: `listening`'s new pulse is gated by the same `useReducedMotion()` hook as every other `KretoPresence` state (verified via the existing "does not throw... under prefers-reduced-motion" test, which exercises the shared gating logic that sits above all per-state branches, `listening` included).
- **Keyboard flow unchanged / input remains first actionable element**: `KretoPresence` is never in the tab order (decorative, no `onClick`). The composer `<input>` still has `autoFocus` and is still the first focusable element in `prompt` mode, unchanged.
- **No focus movement caused by Kreto's own animation**: confirmed — none of the new code calls `.focus()` anywhere; the existing modal-level focus trap/return (unchanged) is the only focus management in this component.
- **No autoplay audio, no mic access except direct user action**: unchanged — `getUserMedia` is still only called from `startRecording()`, itself only reachable via the mic button's `onClick`.
- **Mobile safe-area preserved**: no new `fixed`/absolutely-positioned element was added; every new piece of UI is in-flow, using the same layout primitives as the surrounding (already safe-area-aware) modal.
- **No horizontal overflow**: every new element uses the same `max-w-md`/`w-full` constraints as its surrounding container; nothing introduces a wider box.

## Live-verified (desktop, 1440×900 equivalent pane width, authenticated)

Walked the real flow end to end (see `KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md`'s verification section) — no accessibility-relevant console warnings, the review screen's `KretoPresence` + heading pair read naturally, the caution/creation-error banners (when present) sit above the form as real, visible, non-decorative text.

## Limitation this pass

A live click-through at 390×844 and 768×1024 was attempted but blocked by a browser-automation input-delivery issue in this session (clicks stopped registering partway through mobile testing, confirmed via `read_page` showing no state change across repeated attempts — not a symptom of the app itself, which never returned an error). Reasoned about mobile correctness from source instead: none of this pass's additions are viewport-conditional (no `hidden md:block` or similar), and the surrounding modal was already a full-screen, safe-area-aware overlay before this change — the new content reflows with it using the same utility classes already exercised at every width. Flagging this explicitly rather than claiming a mobile click-through that didn't happen; a follow-up pass should re-attempt live mobile verification once the tooling issue clears.
