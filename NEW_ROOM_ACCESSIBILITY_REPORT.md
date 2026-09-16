# New Room — Accessibility Report

## Fixed this pass, verified both by test and live browser

| Gap found in audit | Fix | Verified |
|---|---|---|
| No focus trap — Tab could escape the modal into the page behind it | Manual `keydown` handler queries focusable elements inside the modal on Tab/Shift+Tab and wraps at the boundaries | Live: Shift+Tab from the first focusable element (Close) wrapped to the last (a "More ways to start" card), confirmed still inside the dialog via `dialog.contains(activeElement)` |
| No focus return on close — closing just unmounted the component | Stores `document.activeElement` on open, restores it on close | Live: Escape closed the modal and focus visibly returned to the "Open a New Room" trigger button |
| `aria-label="New Room"` duplicated the visible heading as a static string instead of referencing it | `aria-labelledby="new-room-title"` pointing at a real `id` on the visible "New Room" label in the top bar | Live: `dialog.getAttribute('aria-labelledby')` → `"new-room-title"` → `document.getElementById(...)` resolves to an element with text "New Room" |
| Initial focus | Already correct before this pass (`closeButtonRef.current?.focus()` on open) — confirmed still correct | Live: `document.activeElement` after open has `aria-label="Close"` |

## Confirmed already correct, not touched

Escape handling (real `keydown` listener, not simulated). `role="dialog"`/`aria-modal="true"` present. Voice is not the only input path (text/file/link all present and reachable without touching the mic). No animation-only feedback found — every mode transition (recording/thinking/review) is paired with real text, not just a color or motion change.

## Reduced motion — full code-path audit

No direct `prefers-reduced-motion` emulation control was available in the browser tooling used this pass, so this was verified by reading every motion call site rather than live OS-level toggling. `useReducedMotion()` (the same shared, already-proven hook used throughout the app) gates all 7 framer-motion entry/exit/loop call sites across both files: `StudioCreateHero.tsx` -- the rotating-prompt-line interval effect itself (stops the state cycling, not just the transition, when reduced motion is on), the prompt-line's enter/exit animation, and the proof-strip's scroll-in animation; `VoiceFirstCreateModal.tsx` -- the how-it-works step reveal, the thinking-step crossfade's enter/exit, and the progress-bar gradient sweep. The one animation not individually gated -- the mic button's plain-CSS `animate-ping` halo -- is covered instead by the app's existing global rule in `src/index.css` (`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; ... } }`), confirmed present and unconditional across the whole app, not added by this pass.

## Test coverage added

`VoiceFirstCreateModal.test.tsx` locks in the `role`/`aria-modal`/`aria-labelledby` contract, Escape-closes, close-button-closes, and initial-focus behaviors as automated regression tests — the first tests either component in this file had.

## Not covered this pass

Full screen-reader pass (VoiceOver/NVDA) on the review screen's dynamic content (starter-task checklist, room-type picker) — read for semantic correctness (real `<label>`/checkbox pairings, real `<button>` elements throughout) but not exercised with an actual screen reader.
