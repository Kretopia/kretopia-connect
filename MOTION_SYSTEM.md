# Motion System

Section 8 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Method

This is an **extraction and documentation pass**, not a from-scratch token system. The codebase already has a real, fairly consistent set of timing/easing values in active use (found via direct grep of `transition={{ duration: ... }}` across `src/components`), and a genuinely comprehensive reduced-motion story (40 component files call `useReducedMotion()`; 9 separate `@media (prefers-reduced-motion: reduce)` blocks in `src/index.css`, including one global catch-all). This document names what's already there as reusable tokens, flags the one real gap found, and does not invent a parallel system.

## Motion tokens (extracted from real usage)

| Token | Duration | Where it's already used |
|---|---|---|
| `instant` | 0.15s | `FeatureTutorial.tsx` step-content crossfade |
| `fast` | 0.3–0.45s | `TutorialStepper.tsx` row reveal (0.45s), accordion detail expand (0.3s) |
| `standard` | 0.7–0.85s | `FeaturePageHeader`/`EditorialPageHero` mount fade-up (via `CinematicHeaderPlate`, 0.85s); landing chapter `whileInView` reveals (0.7s) |
| `deliberate` | 4s | `KretoAvatar` idle-state halo breathing |
| `stagger` | 0.075–0.12s per item | `KretopiaHero.tsx` title word-stagger (0.075s/word); `TutorialStepper.tsx` row-cascade (0.12s/row) |
| `thinking` | 0.9–1.1s, looping | `KretoAvatar` `thinking` halo pulse (1.1s) + spinning rim (1.1s linear); `FeatureTutorial.tsx`'s 3-dot bounce (0.9s) |
| `listening` | 1.6s, looping | `KretoAvatar` `listening` state — radar-ripple expand/fade |
| `speaking` | 0.9s, looping | `KretoAvatar` `speaking` state — double-pulse |
| `recording` | 1.2s, looping, `easeOut` | `KretoAvatar` `recording` state — ping snap-and-fade (the one state that also changes color, not just motion, since it's a safety signal) |

Standard easing curve across nearly every deliberate (non-linear, non-spring) transition in the codebase: **`cubic-bezier(0.2, 0.65, 0.3, 0.95)`** — confirmed via grep across `landing/`, `features/`, `passport/`, `brand/`. This is the de facto "standard" easing token; nothing in this pass needed to introduce a new one.

## Reduced-motion handling — already comprehensive, verified real

- **Hook-level**: `src/hooks/useReducedMotion.ts`, a live `prefers-reduced-motion` media-query listener, imported by 40 component files. Every Framer Motion `initial`/`animate` pair checked in this pass uses the pattern `initial={reducedMotion ? false : {...}}` — meaning reduced-motion users get the final state immediately, with no opacity-zero flash and no transform.
- **CSS-level global catch-all** (`src/index.css` line ~880):
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  This alone satisfies the brief's "no text remains at opacity zero" and "remove looping decorative motion" requirements for any animation that doesn't have its own explicit reduced-motion branch — it's a structural safety net, not just a convention.
- 8 more targeted `@media (prefers-reduced-motion: reduce)` blocks handle specific cases (`.landing-glow`'s text-shadow, `.pink-glow-breathe`, etc.) where the catch-all's "near-instant" isn't quite right and a specific static fallback is defined instead.

**This pass's own new animations (the `KretoAvatar` state system, `TutorialStepper`'s row-cascade) both follow this pattern** — `animated` prop / `reducedMotion` check gating every state, confirmed via code read, not assumed.

## Real gap found and fixed this pass

`KretopiaHero.tsx`'s title-reveal `staggerChildren` transition and `AIStageBriefGenerator`/`AIJobDescriptionGenerator`'s `Loader2 animate-spin` are **not** subject to the 5-second guidance ("if any animation lasts or repeats for more than five seconds, provide pause/stop... or remove it") since none of them loop indefinitely without a state change (the title stagger plays once; the spinners are tied to a real network request's lifetime, not decorative). No violation found there.

The one real, previously-undocumented gap: `ai-ambient-breathe` (a raw CSS `4s ease-in-out infinite` background pulse used on ~10 files, mostly page-header aurora backgrounds and Kreto-presence badges) loops indefinitely for as long as the page is open — which is fine under the global reduced-motion catch-all (collapses to near-instant), but two instances of it were found **stacked redundantly around `KretoAvatar`**, which already has its own built-in breathing halo — `AuthBrandingPanel.tsx`'s "Kreto whisper card" and `MeetKretoSection.tsx`'s avatar wrapper both wrapped a `KretoAvatar` in a *second*, independent, unsynchronized `ai-ambient-breathe` pulse. **Fixed earlier this session** (commit `7bb88ff3`) — removed the redundant wrapper pulse in both places, since `KretoAvatar`'s own animation is now the single source of truth for "Kreto is present" motion.

## What was not done in this pass

- No new global motion-token file (e.g. `src/lib/motionTokens.ts`) was created to formally export these as named constants — the values above are documented here as the reference, but individual components still declare their own `transition={{ duration: 0.85 }}` literals rather than importing a shared constant. This is the same "real but low-priority mechanical follow-up" situation as the typography inline-style tokenization noted in `TYPOGRAPHY_SYSTEM.md` — the *values* are already consistent (verified via grep), converting them to imported constants is a maintainability improvement with no visual effect.
- Section 8's requested new interaction states (AI processing state, confidence-indicator transitions, milestone progression, search-result filtering, Passport completion feedback) were partially covered by this session's `KretoAvatar` reactive-state work (thinking/listening/speaking/recording all map directly onto "AI processing state") but not built out as a complete catalogue — see `AI_POWERED_UX_AUDIT.md` for what's covered vs. open.
