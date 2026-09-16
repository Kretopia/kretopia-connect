# Kreto Hero + New Room Browser Verification Matrix

## Status: `NOT_STARTED`

This pass is a read-only audit — no Hero-scene, mobile/tablet, New Room state-mapping, or `listening`-state code was written, so there is nothing yet to verify at 390×844 / 768×1024 / 1440×900, in Day/Night, or under reduced motion. Recorded as `NOT_STARTED` rather than skipped or assumed, so it isn't mistaken for a passed check later.

## What this matrix will cover once something is implemented

| Surface | 390×844 | 768×1024 | 1440×900 | Day mode | Night mode | Reduced motion |
|---|---|---|---|---|---|---|
| Hero (existing desktop badge) | — | — | Previously verified, `LANDING_HERO_BROWSER_VERIFICATION_MATRIX.md` | Not reachable app-wide (documented pre-existing lock, `LANDING_DAY_NIGHT_VISUAL_QA.md`) | Previously verified | Previously verified |
| Hero (mobile/tablet placement, Gap 1) | Not started | Not started | n/a | n/a | Not started | Not started |
| Hero (narrative scene, Gap 2) | Not started | Not started | Not started | n/a | Not started | Not started |
| Hero (CTA-linked attentive, Gap 3) | n/a (no hover on touch) | n/a | Not started | n/a | Not started | Not started |
| Hero (scroll transition, Gap 4) | Not started | Not started | Not started | n/a | Not started | Not started |
| New Room (`listening` state) | Not started | Not started | Not started | n/a | Not started | Not started |
| New Room (`caution`/`success`/`error` mapping) | Blocked on product decision (see state mapping audit) | | | | | |

The existing desktop Hero badge's own prior verification is unaffected by this pass — nothing about it changed.
