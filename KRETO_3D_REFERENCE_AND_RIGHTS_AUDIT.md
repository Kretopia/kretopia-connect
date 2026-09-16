# Kreto Embodied Presence — Reference, Rights & Existing-System Audit

## Status: `AUDITED` — no code has been edited. This document only.

## Rights outcome: `UNKNOWN_RIGHTS_ORIGIN`

## 0. Safety check

```
git status -> only supabase/functions/mcp/index.ts modified (pre-existing, unrelated,
              left untouched all session) + LANDING_HERO_AVATAR_ASSET_AUDIT.md
              (untracked, from the immediately prior task, not yet committed)
git diff / git diff --staged -> nothing beyond the above
```

No stashes, resets, or destructive operations. Recent history: [PR #91](https://github.com/thrivein-app/thrivein-new-beta/pull/91) (open, Signal Field work) is the current tip of `feature/reliability-overhaul`.

## 1. Reference image description

A cinematic 3D render titled "Meet Kreto — Your AI Executive Producer": a central white/pearl rounded humanoid robot (large dark visor-head, crescent-shaped glowing pink-to-violet eyes, a gradient "K" mark on its chest, one arm raised in a wave), surrounded by four smaller role-variant tiles labeled Scout, Connector, Producer, and Publicist, each showing the same character with a distinct held prop (magnifying lens, network-node icon, tablet, megaphone). Kretopia's real wordmark and K-mark appear at the top. Warm magenta/violet rim lighting against a near-black background.

## 2. Rights classification — the decisive finding

The user also attached `Kretopia_Kreto_Evolution_Brief_v1.docx` (read via `textutil`, since the Read tool cannot parse binary `.docx`). That document — an internal strategy brief, "prepared for internal product and brand alignment," addressed to "Noé" — contains this, verbatim, under **"VISUAL DIRECTION FOR NOÉ":**

> "Kreto should inherit the strongest **Blinky** idea: one expressive core character with recognizable role variants... **Current direction reference: Blinky-style core character translated into Kretopia. Refine before locking.**"

This is first-party, written evidence — not my own inference — that the attached image is styled after something called **"Blinky,"** and that the team's own brief explicitly instructs to **refine it before locking**, i.e., it is *not* already a cleared, finalized, original Kretopia asset. I don't know what "Blinky" refers to (a specific commercial character, another product's mascot, an earlier internal concept, or an AI-image-generator style reference) — the document doesn't say, and I have no way to independently resolve that from this repository. Per this brief's own decision rule ("If rights are not explicitly confirmed... create an original Kreto design inspired by high-level visual attributes only"), the correct default here is to **not** treat the reference image as an approved, direct-use asset.

**Recommendation, not a block**: ask the user to confirm what "Blinky" refers to and its licensing status before this character ever ships as a public-facing marketing asset (the "Meet Kreto" key art use case the docx itself lists as a "suggested first design output"). This audit proceeds on the safe path regardless — building an original interpretation — so implementation is not blocked on that answer, but it should be resolved before wide rollout.

**The strategic concept itself is unambiguously team-owned**: the role-mode system, naming ("Kreto Modes"/"Kreto Crew"), state model, phased rollout plan, and website copy in the docx are original Kretopia product strategy, not third-party material. Only the *specific character rendering* attached to this conversation carries the flagged uncertainty.

## 3. Identifiable third-party design risk

The reference's specific execution — glossy white/pearl ovoid shell, oversized dark visor, paired crescent glow-eyes, chibi proportions — is a very common archetype in contemporary AI-generated "friendly companion robot" marketing art; it doesn't resemble one single, easily-identifiable copyrighted character by name. That said, "common archetype" is not the same as "safe to reproduce exactly," and the brief's own document explicitly flags this exact image as an unrefined external reference (see §2). **Risk assessment: moderate-low for a specific IP match, but the team's own document already correctly identifies this reference as needing to change before it's usable as final.**

## 4. Approved visual attributes to reuse (from the team's own "Character rules to lock")

This is the most valuable output of the docx for this task — the team has already written non-infringing, specific, actionable design direction that explicitly *corrects away* from the attached reference:

- Same silhouette/head-shape/visor/proportions/materials across every role variant (accessory-driven differentiation, not costume changes).
- Expressive black visor, simple eye language — friendly, emotionally legible, **not childish**.
- **"Deeper graphite and near-black body materials with selective warm off-white panels, rather than a mostly white toy-like shell."** This is the team's own explicit correction away from the attached image's white shell — direct confirmation that the reference is a starting point to diverge from, not a target to match.
- Kretopia gradient (`--energy` pink, per the existing token system) used as a **precision accent** — light rings, chest mark, role signal, small interface moments — never a constant neon glow.
- The **exact, real** Kretopia K-mark on the body (`kretopia-k-mark.png.asset.json` / `KretoMark`), never redrawn or approximated.
- A single "signal" cue — inspired by the gradient dot in the Kretopia wordmark — integrated into the visor or side of the head, animatable for listening/thinking/acting/mode-switching states.
- Premium 3D finish: cinematic lighting, soft reflections, restrained depth of field (achievable via a well-lit pre-rendered static/sprite asset — see §8 — without a live renderer).

## 5. Attributes that must not be copied

Per this brief's own rule and reinforced by the docx's own "refine before locking": the reference's exact head/visor geometry, exact proportions, exact "mostly white toy-like shell" material treatment, exact eye shape/size, exact pose, and exact accessory renderings (magnifying lens, megaphone, etc. as pictured) should not be reproduced pixel-for-pixel. The *idea* of role-specific accessories is fine (the docx explicitly wants this); the *specific rendered execution* in the attached image is not the target.

## 6. Existing Kretopia visual assets

| Asset | Path | Relevance |
|---|---|---|
| Official K-mark | `src/assets/brand/kretopia-k-mark.png.asset.json`, via `KretoMark.tsx` | Must appear exactly, per docx's own rule — already a reusable component with `bare`/`default`/`compact`/`muted`/`status`/`interactive` variants and an `ActivityState` prop (`idle`/`active`/`pending`/`recording`) |
| Kreto's current portrait | `src/assets/kreto-avatar.png`, via `KretoAvatar.tsx` | Kreto's existing 2D likeness — the closest thing to "Kreto's current face" in the repo today; worth reviewing before designing a new embodied form so the two don't visually contradict each other |
| Generic anonymized silhouette | `public/avatar-silhouette.svg` + `src/assets/avatar-silhouette.svg` | Unrelated to this task (used for human user fallbacks), noted only for completeness |
| Hero photography | `src/assets/kretopia-hero.jpg`, `kretopia-hero-portrait.jpg` | Unrelated to Kreto specifically |

## 7. Existing Kreto identity system — richer than the mega-brief assumed

- **`KretoMark.tsx`** — already documented as "not a face, not a robot, not a generic AI orb," with a paired `sr-only` label for any activity `state`. This is the *current* embodied identity, and the new presence system should extend, not fight, this component's existing state contract.
- **`KretoLauncher.tsx`** — the desktop "open Kreto" affordance, currently `<KretoMark variant="bare" size="lg" />` inside a fixed-position button, dispatching a `thrive-copilot:open` event. **This is the natural drop-in point for a new embodied idle/hover presence** — same event, same position, upgraded visual.
- **`KretoTip.tsx`** — a contextual "whisper card" already implementing the docx's own suggested compact-label pattern: `Kreto · {tip.eyebrow}` next to `<KretoMark variant="default" .../>`. **The "KRETO · SCOUT" style labeling the docx asks for already exists in production code**, just paired with the flat mark rather than an embodied character.
- **`KretoFab.tsx`** — a thin wrapper around the existing `ThriveAgentFab` (the real chat surface, with real Realtime plumbing) — confirms the actual conversational Kreto experience already exists and is not part of this task's scope to change (per the mega-brief's own "do not change Kreto backend logic").
- **No literal "Kreto · Studio" string exists yet** in the codebase — it's the docx's suggested label convention, not yet applied to a Studio surface. Any Studio placement in this pilot would be a genuinely new integration point, not a refresh of an existing one.

## 8. Candidate implementation technologies

**No 3D/WebGL infrastructure exists today** — confirmed via `package.json` (no `three`, `@react-three/fiber`, `@rive-app`, or `lottie` dependency) and a full-repo grep (zero `WebGLRenderer`/`useFrame` usage anywhere). Adding a live 3D engine would be a genuinely new, non-trivial dependency — directly against this brief's own instruction ("do not add a live 3D engine merely because '3D' was requested... only if existing infrastructure supports it").

**Recommendation: this brief's own priority #1 or #2** — an optimized layered SVG/CSS illustration (for the idle/hover/signal-dot states, which are simple enough to animate with `transform`/`opacity` alone, matching the existing `framer-motion` patterns already used everywhere on Landing) or a small set of pre-rendered transparent WebP frames for the "premium 3D finish" look the docx wants, cross-faded via CSS on state change. Either path uses only what's already a dependency (`framer-motion`) or adds zero new runtime dependency at all. Real WebGL is not recommended for the pilot.

## 9. Bundle/performance impact

Baseline (from this session's own repeated Lighthouse measurements against the production build): Performance 93-96, LCP 1.2-1.5s, TBT 0ms, CLS ~0.003-0.004. A layered-SVG or sprite-frame Kreto presence, lazy-mounted (not on the Landing critical path — `KretopiaLanding.tsx` is already only 12.4KB specifically because non-essential visuals are deferred), should not measurably move these numbers. A live WebGL alternative would very likely regress LCP/TBT/bundle size and is not justified by the available design requirements.

## 10. Mobile feasibility

Straightforward for the SVG/sprite-frame path (same technique already used for the Signal Field's responsive sizing on `KretoMark`). A WebGL path would need explicit low-power-device fallbacks per this brief's own §4 requirements — another reason to avoid it for the pilot.

## 11. Accessibility plan

Reuse the exact pattern already established in this session's Signal Field work and in `KretoMark` itself: decorative instances `aria-hidden="true"`, interactive instances get a real `<button>` with an accessible name (the existing `KretoLauncher`/`KretoFab` pattern already does this correctly), every state also expressed as real text (matching `KretoMark`'s own existing `sr-only` state-announcement pattern — do not diverge from it), full `useReducedMotion()` gating (already the established hook used by every animated Landing component this session).

## 12. Pilot surfaces (per this brief's §6, mapped to real integration points)

1. **Kreto feature** — upgrade `KretoLauncher.tsx`'s visual from flat `KretoMark` to the new embodied presence at the idle/processing/proposal-ready/error states already implied by the existing `ActivityState` type on `KretoMark`.
2. **Landing Hero** — a static-to-subtle presence added to `KretopiaHero.tsx`, secondary to title/CTA (this session's own established hierarchy work), likely on the right/lower-right, not overlapping the content column's safe zone already mapped in `LANDING_HERO_AVATAR_ASSET_AUDIT.md`.
3. **Studio** — a new integration inside `KretoTip.tsx` (already renders `KretoMark` + a compact label in exactly this role) rather than inventing a new Studio-side component from scratch.

## 13. Rollout surfaces (documented per §7, not implemented without approval)

Scout, Passport guidance, Events recaps, Stage context, New Room intake, Verified Credits insights — each would reuse `KretoTip.tsx`'s existing pattern where applicable. Not scoped further until pilot review, per this brief's own instruction.

## 14. Files to modify (pilot phase only, after approval)

- `src/components/brand/KretoMark.tsx` (extend, not replace — add the new embodied visual as an opt-in prop/variant so every existing call site keeps working unchanged) **or** a new sibling component (`KretoPresence`) that existing callers migrate to deliberately, not automatically.
- `src/components/kreto/KretoLauncher.tsx`, `src/components/agent/KretoTip.tsx` — pilot integration points.
- `src/components/landing/KretopiaHero.tsx` — Landing pilot placement.
- New asset files (SVG/WebP) under `src/assets/brand/` or a new `src/assets/kreto/` directory.

## 15. Files to protect

Everything in the mega-brief's own §0 list: `ThriveAgentFab`/Realtime plumbing (the real chat logic `KretoFab` wraps), all auth/RLS/payments, AI model routing, tool-approval policy, `KretoAvatar.tsx` (Kreto's existing 2D portrait, not to be silently replaced without a decision), every other Landing section, all routes.

## 16. Test plan (for the implementation phase)

Component render tests for each new visual variant (idle/hover/etc.), a test asserting no WebGL/three.js dependency was introduced, reduced-motion safety (mirroring this session's `KretopiaHero.test.tsx` pattern), and a bundle-size check that the Landing critical-path chunk (`KretopiaLanding.tsx`) doesn't grow if the Hero placement is implemented.

## 17. Browser verification plan

390×844 / 768×1024 / 1440×900, Day and Night (noting Night is the only reachable state for real users today, per `LANDING_DAY_NIGHT_VISUAL_QA.md`), reduced motion, keyboard/focus on any interactive instance, console/network check, and a Lighthouse before/after comparison on the Landing route specifically (matching this session's established before/after methodology).

## Summary of flags requiring a decision before implementation

- **`UNKNOWN_RIGHTS_ORIGIN`**: recommend the user confirm what "Blinky" refers to before this character ships as public marketing key art. Implementation can proceed on the safe/original path regardless.
- **`REQUIRES_PRODUCT_DECISION`**: whether the new embodied presence extends `KretoMark` in place (risk: every existing call site's visual changes at once) or ships as a new sibling component adopted deliberately per surface (safer, more consistent with "pilot first").
- Scope, pilot surfaces, and technology choice (layered SVG/CSS or pre-rendered sprite frames, no WebGL) are recommended above but not yet approved for implementation.

`KRETO_3D_RIGHTS_AUDIT_COMPLETE`
