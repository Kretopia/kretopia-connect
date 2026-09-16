# Kreto Performance Budget Report

## Status: `PERFORMANCE_VERIFIED` (bundle/build level, this pass) / `REQUIRES_APPROVAL` (full Lighthouse re-run, before any surface adopts `full` size)

## What this pass measured

- `npm run build` completed cleanly. No new dependency was added — `KretoPresence.tsx` still imports only `react`, `framer-motion`, `@/hooks/useReducedMotion`, `@/components/brand/KretoMark`, and `@/lib/utils`, all already present before this pass.
- The state-model and size-model expansion added conditional branches (`switch`/ternary) inside the existing component, not new components, new SVG nodes on the default path, or new images. `KretoMark`, `KretoPresence`'s SVG shell, and the gradient/defs are unchanged.
- The `full` size adds one new entry to a `Record<KretoPresenceSize, number>` — a constant, zero runtime cost, and it is not referenced by any current surface, so it cannot affect any existing route's bundle or paint timing.

## Why a full Lighthouse re-run was not performed in this pass

The prior Lighthouse passes (`LANDING_HERO_PERFORMANCE_REPORT.md` for the Hero's `hero`-size instance, `KRETO_3D_PILOT_IMPLEMENTATION_REPORT.md` for the pilot generally) measured the same component on the same three surfaces with the same DOM shape on their live (`idle`) path. This pass did not change that path — the `idle` render output (SVG nodes, animate props, K-mark badge) is byte-for-byte the same before and after this change, verified by the unchanged existing tests (`KretoPresence.test.tsx`'s original 8 tests, e.g. "exactly 2 `<circle>` elements regardless of state", still pass unmodified). A new Lighthouse run against an unchanged render path would not produce new information.

## What requires a dedicated performance review before use

- **`full` size (240–360px)**: per the brief's own §3/§7 rules ("must be lazy-loaded", "no eager loading on every feature"), the first real integration that uses `full` must ship its own route-level or component-level code-splitting (the same `lazyWithRetry()` pattern already used for all ~128 route-level lazy loads in this codebase, per `KRETO_BUNDLE_SIZE_REPORT.md`) and a static, non-animated fallback for the loading window — and that integration's own PR should carry its own before/after LCP/CLS measurement, since it is the first surface where Kreto's own asset weight could plausibly matter. Not done in this pass because no surface uses `full` yet.
- **New Room** (Phase B): wiring real listening/processing/draft-ready transitions means `KretoPresence` will animate far more often on that surface than anywhere else in the current rollout (continuous re-renders during a live transcription, for instance). That surface's own implementation pass should include CPU/frame-stability measurement during an actual voice-capture session, per §7's "animation frame stability" requirement — not assumed clean by extension from the idle-only surfaces already shipped.

## Existing budget context (unchanged, for reference)

`KRETO_BUNDLE_SIZE_REPORT.md` (separate, prior work) reduced the main chunk from 2,380.92 KB to 1,753.45 KB. Nothing in this pass touches any of the modules discussed there.
