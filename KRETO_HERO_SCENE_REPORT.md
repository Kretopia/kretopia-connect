# Kreto Hero Scene Report

## Status: `AUDITED`. Current desktop badge complies with the brief; the fuller "narrative scene," the mobile/tablet treatment, and the CTA-linked `attentive` behavior are `NOT_STARTED`.

Read in full for this pass: `src/components/landing/KretopiaHero.tsx` (293 lines).

## What exists today

- One `KretoPresence size="hero" state="idle"` instance, `pointer-events-none`, positioned `absolute bottom-8 right-8`, `hidden lg:block`, `opacity-70` — desktop (`lg`+) only.
- Priority order already matches the brief exactly: headline (`h1`) and the CTA pair render earlier in source order and are never overlapped (Kreto sits in the section's bottom-right corner, well outside the centered `max-w-[900px]` content column at every desktop width tested previously — see `LANDING_HERO_AVATAR_ASSET_AUDIT.md`'s measurements, unchanged since).
- The existing "Verified Creative Signal Field" (grey-to-pink radial gradient, faint coordinate grid, top-center `KretoMark`) already supplies the "background/decorative field" tier the brief wants beneath Kreto in the priority stack.
- `state="idle"` only — correct, since a guest landing page has no live Kreto request to honestly report.

## Gap 1: no tablet/mobile treatment at all

The instance is `hidden lg:block` — below the `lg` breakpoint it renders nothing, not a scaled-down or compact version. The brief asks for a scaled/repositioned presence on tablet and a compact/static version below the Hero CTA on mobile, never fully absent. This was a deliberate prior decision (documented in `LANDING_HERO_AVATAR_ASSET_AUDIT.md`: no genuine peripheral space exists below `lg` without risking overlap on the centered content column), and it still holds for the *current* single-badge treatment — but the brief's mobile placement ("below Hero CTA or in a compact right-side section... do not use full-size robot if it pushes the CTA below the fold") describes a materially different layout (Kreto in-flow below the CTA, not floating in a corner) that was never built or measured. This needs real implementation and its own CLS/below-fold measurement, not an extension of the existing corner-badge approach.

## Gap 2: no "narrative scene" (scattered work → Passport → Credits → opportunity)

Today's Hero renders exactly one `KretoPresence` badge and nothing else representing that narrative — no cards, proof nodes, line connections, Passport silhouette, or credit shapes. Building this is a genuine new visual composition, not a state-model change: it needs its own layout (how many fragments, their positions within the existing safe zone, how "connections" render without competing with the headline), its own reduced-motion treatment per fragment, and its own performance check (more DOM nodes/animations in the Hero than exist today). Scope-wise this is comparable to the original Signal Field redesign (`LANDING_HERO_SIGNAL_FIELD_AUDIT.md`), which itself was a dedicated audit-then-implement pass — recommend treating this the same way rather than folding it into a general Kreto pass.

## Gap 3: no CTA-linked `attentive`

`KretoPresence`'s `attentive` state (from the prior pass, `KRETO_STATE_MACHINE_REPORT.md`) is currently only self-triggered by real hover/focus on `KretoPresence`'s *own* button — and the Hero's instance isn't even interactive (no `onClick`), so it can never self-trigger attentive today. The brief wants attentive triggered by hovering/focusing the Hero's *CTA links* instead, which are a separate DOM subtree. This is buildable without changing `KretoPresence` itself: `state` already accepts the literal `"attentive"` from any caller, and `KretopiaHero.tsx` already tracks pointer position for the signal-field parallax — adding `onMouseEnter`/`onFocus`/`onMouseLeave`/`onBlur` to the two CTA `Link`s, lifted into a local boolean, and passing `state={ctaHovered ? "attentive" : "idle"}` down to the (still non-interactic, `aria-hidden`) Hero `KretoPresence` would be a small, honest, low-risk addition — genuinely real hover state, not fabricated. Not implemented in this pass.

## Gap 4: no scroll transition

The brief wants a small fade/scale/settle as the Hero scrolls out of view. Nothing in `KretopiaHero.tsx` currently ties any animation to scroll position (the existing pointer-based field parallax is mouse-driven, not scroll-driven). Buildable with a `useScroll`/`useTransform` pair (Framer Motion, already a dependency) scoped to the Hero section's own bounds — not implemented in this pass.

## What does NOT need to change

The safe-zone geometry, the `pointer-events-none` decorative posture, the `idle`-only state honesty, and the desktop placement itself are all already compliant and should be preserved as the foundation any of the above gaps get built on top of.
