# Kreto Hero + New Room Performance Report

## Status: `AUDITED`. No implementation in this pass, so nothing to measure yet — this establishes the budget and method for whichever piece gets built next.

## Landing Hero

- **LCP risk**: `LANDING_HERO_PERFORMANCE_REPORT.md` (prior pass) already confirmed the existing `hero`-size `KretoPresence` instance does not become the Hero's LCP element (the `h1` headline is). Any new scene fragments (Gap 2 in `KRETO_HERO_SCENE_REPORT.md`) must be re-measured specifically, since more DOM nodes/gradients in the Hero's above-the-fold area is exactly the kind of change that could shift LCP timing or candidate — not assumed clean by extension.
- **CLS risk**: the existing instance uses a fixed-pixel `width`/`height` (`SIZE_PX`) on its wrapping `motion.div`, so it never causes layout shift on its own. A mobile/tablet in-flow placement (Gap 1) is the one variant that risks CLS if its container doesn't reserve space up front — needs explicit fixed dimensions from the start, not measured after the fact.
- **No new dependency**: nothing in this brief requires a library beyond what's already present (Framer Motion for the scroll-transition, already a hard dependency).

## New Room

- The existing `KretoMark size="xl" state="active"` already renders in `thinking` mode today with no reported performance issue. Swapping it for `KretoPresence` (same underlying SVG+Framer-Motion approach, already loaded on this route since `KretoTip` also uses it elsewhere) adds no new dependency and negligible weight.
- **Animation frame stability during real voice capture**: this is the one genuinely new performance question this brief raises. `listening` mode would be the first place in the entire rollout where `KretoPresence` animates continuously *during* a real, latency-sensitive user action (an active `MediaRecorder` capture) rather than during an idle decorative moment. This needs its own CPU/frame-stability check once built — not something the existing pilot's measurements (all `idle`-only) can be assumed to cover.
- **Offscreen/unmount cleanup**: `VoiceFirstCreateModal`'s own `useEffect` on `!open` already tears down `MediaRecorder`, its stream tracks, and every piece of local state (lines 162–184) — a `KretoPresence` instance placed inside this modal unmounts along with everything else automatically; no separate cleanup path would be needed.

## Budget going in

No item in either surface should regress: Landing Hero LCP/CLS (re-measure if Gap 2 is built), New Room's initial render time (currently instant — a local `mode` change, no network round-trip to open), or New Room's input responsiveness while recording (the new frame-stability check above). None of this has been measured in this pass since nothing was implemented — recorded here as the acceptance bar for whichever surface is built next.
