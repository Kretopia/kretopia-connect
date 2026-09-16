# Kreto Hero + New Room Accessibility Report

## Status: `AUDITED` — foundations already comply; specific new behaviors need verification once built (`DEFERRED` until implementation).

## Landing Hero

- **Keyboard order**: confirmed by source order in `KretopiaHero.tsx` — the CTA pair (`Link` elements) render at lines 227–256, the decorative `KretoPresence` at line 276-278, after them and `aria-hidden`-by-default (no `onClick`, so it renders through `KretoPresence`'s non-interactive branch, `aria-hidden="true"`). The CTA is reachable by keyboard before Kreto is encountered at all, and Kreto is never in the tab order regardless, since it has no `onClick`. This already satisfies "Hero CTA remains keyboard reachable before any decorative robot element."
- **No status conveyed by movement alone**: the existing instance is `state="idle"`, which has no `sr-only` announcement (correctly — there's nothing to announce). If `attentive` is wired to real CTA hover/focus (per `KRETO_HERO_SCENE_REPORT.md` Gap 3), no announcement is needed for that either, per the same reasoning already documented in `KRETO_STATE_MACHINE_REPORT.md` (a hover micro-affordance on a control that already has its own accessible name/route is not an app-state change requiring a separate announcement) — the CTA `Link`s already have real, distinct link text ("Build My Passport", "Explore Opportunities").
- **Reduced motion**: `useReducedMotion()` already gates the Hero's own word-reveal and field-parallax animations, and `KretoPresence` independently gates its own via the same hook. A future scroll-transition (Gap 4) or scene-fragment animation (Gap 2) must route through the same hook — not yet built, so not yet verified.
- **No pointer interception**: the existing instance is `pointer-events-none`; any new scene fragments must preserve this unless a fragment is made genuinely interactive with its own real destination (the brief doesn't call for that, and none is planned).

## New Room

- Already has real, hand-built accessibility infrastructure independent of Kreto: a manual focus trap (Tab/Shift+Tab wrapping within the modal, lines 582–599), Escape-to-close, and focus return to the previously-focused element on close (lines 605–614) — confirmed by reading the full file. This is a solid foundation to place a `KretoPresence` instance into without needing to rebuild any of it.
- **Decorative by construction**: every proposed placement (see integration report) is non-interactive (no `onClick`), so each one would render through `KretoPresence`'s `aria-hidden` branch automatically — no extra work needed to keep it out of the tab order.
- **State-in-text requirement**: `processing`/`proposal_ready`/`caution`/`success`/`error`/`listening` (once built) all need their real meaning available as visible, non-`sr-only` text too, per the brief's "state text must be visible separately" rule for New Room specifically (stricter than a generic `sr-only` announcement). Convenient here: every mode in `VoiceFirstCreateModal.tsx` already renders real visible copy of its own (`"What are you making?"`, `"Tap to stop when you're done"`, the cycling `THINKING_STEPS` text, `"Kreto structured your project — review and edit"`) — so the requirement is already met by the surrounding UI, independent of whatever `sr-only` text `KretoPresence` itself adds. No new visible-text component would be needed.
- **Input primacy**: the brief requires "New Room inputs remain primary and reachable." The recommended top-of-content placement (integration report) keeps every real input (composer, mic button, file/link buttons, review-step form fields, footer buttons) in its existing position and tab order — Kreto is additive above them, not inserted between them.

## Not verifiable yet

Live browser/axe verification (200% zoom, Day/Night contrast on the new `caution`/`listening` colors in this specific context, no-overflow at 390×844/768×1024/1440×900) cannot be reported as done because none of this is implemented yet. Listed here so it isn't silently skipped later — see `KRETO_HERO_NEW_ROOM_BROWSER_MATRIX.md`.
