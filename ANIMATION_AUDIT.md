# Animation System Audit

Scope: every `animate-pulse` / `animate-ping` / `animate-bounce` / `animate-spin` / `animate-shimmer` usage in `src/`, classified by function, plus the skeleton-shimmer gradient flagged in the prior findings.

## Method

Counted with `grep -c` per class, then read every `animate-pulse`/`animate-ping`/`animate-bounce` call site in full (154 + 16 + 12 = 182 lines) and a representative, non-random sample of `animate-spin` sites (392 files use it; sampled 30 non-`Loader`-named call sites specifically to stress-test the "is this really a loading spinner" assumption).

## Counts

| Class | Occurrences (files) |
|---|---|
| `animate-spin` | 707 (392 files) |
| `animate-pulse` | 154 |
| `animate-ping` | 16 |
| `animate-bounce` | 12 |
| `animate-shimmer` | 1 definition, ~50 opt-in call sites via `<Skeleton shimmer>` |

## Classification

**`animate-spin` (707) — loading, near-uniformly correct.** Every sampled non-`Loader`-named instance resolved to one of: a manual bordered-circle spinner (`border-4 border-primary border-t-transparent rounded-full`, the same hand-rolled spinner pattern repeated across ~40 files instead of a shared component — a duplication issue, not a motion issue), a `RefreshCw` icon gated by a `refreshing` boolean, or a status icon gated by `status === "running"`. No decorative or ungated `animate-spin` found. Left untouched — this category is functioning as intended. (Noted for Phase 6/scalability: the repeated hand-rolled spinner div is a candidate for consolidating into one `<Spinner>` primitive, not an animation-correctness problem.)

**`animate-bounce` (12) — feedback, entirely correct.** Three-dot typing/thinking indicators (`TypingIndicator.tsx`, `SimpleProjectChat.tsx`, `PricingCoPilot.tsx` — the standard staggered-delay chat pattern) and one-time celebration moments (`FirstMatchCelebration.tsx`, `LevelUpCelebration.tsx`, `OnboardingCelebration.tsx`). No changes.

**`animate-ping` (16) — live/recording/presence radar-dot, entirely correct.** Every instance is a ring pulsing behind a solid "live" dot (recording indicators, presence piles, live-call badges), or the two `BriefDropZone.tsx` / `StudioPulseFeed.tsx` "skydive target" drop-zone rings, which ping only while `dragOver` is true as part of a deliberate radar/target visual metaphor for the file-drop affordance (labeled `{/* Skydive target rings */}` in source) — not a stray/leftover class. No changes.

**`animate-pulse` (154) — mixed, mostly correct, one fix.** Breaks down as:
- ~90 loading-skeleton placeholders (`bg-muted animate-pulse`, `<Card animate-pulse>`, `<Skeleton>`'s default) — correct, this is literally what `animate-pulse` is for.
- ~25 in `src/components/landing/*` (marketing/pre-auth pages) — out of scope per the established gradient-audit precedent: public marketing surfaces are audited separately from the authenticated app.
- ~25 live/recording/status-gated indicators (`isLive`, `recording`, `speaking`, `liveConnected`, availability dots) — correctly gated to a real, changing state.
- 2 status-tier reward treatments (`framed-avatar.tsx`'s `pulse_primary` Rewards Shop frame, `status-avatar.tsx`'s `icon`-tier prestige ring) — deliberate, purchased/earned cosmetic differentiation, the same "gradient IS the feature" exemption already applied to reward-shop avatar frames in the gradient sweep. Left alone.
- 1 genuine violation, fixed: **`QuickMatchBanner.tsx`** stacked two independent, ungated `animate-pulse` calls (a full-panel background gradient pulse *and* a `Zap` icon pulse) on a **persistent** promotional card with no dismiss-until-acted-on lifecycle — pure decorative emphasis with no state to communicate, on a card that can stay mounted indefinitely. Removed both; the card keeps its static icon and copy. Every other single-icon decorative pulse found (`Sparkles` in AI-suggestion headers, `SmartSuggestions.tsx`, `CircleRecommendations.tsx`, `PricingCoPilot.tsx`) is a single, non-stacked instance following the common "AI/smart content" affordance pattern and was left as-is — one subtle cue is a defensible design choice; two stacked on the same static card is not.
- `SoundStagesRail.tsx`'s headliner glow-blur pulse was reviewed and kept: it's a single, isolated effect applied only to the first/featured card in a rail to visually distinguish it from regular items, not stacked with anything else.

## Skeleton shimmer gradient — reviewed, kept

`src/components/ui/skeleton.tsx`'s opt-in `shimmer` variant uses `after:bg-gradient-to-r after:from-transparent after:via-background/20 after:to-transparent`. This was flagged as a known finding to act on. On inspection: the gradient here is neutral (`background` token only, no brand/accent color) and is the load-bearing mechanic of the shimmer effect itself — a light-sweep loading affordance is definitionally a transparent-to-opaque-to-transparent gradient; removing the gradient removes the shimmer, leaving only the plain `animate-pulse` variant that already exists as the non-shimmer default. This falls under the same Category C exemption ("material/lighting effect where the gradient is the mechanism, not decoration") used throughout the earlier gradient sweep, not the Category A "decorative brand sweep" the flattening effort targeted. Kept as-is; documented here rather than silently ignored.

## Reduced motion

Confirmed still intact: `src/index.css:841` — global `@media (prefers-reduced-motion: reduce)` collapses all `animation-duration`/`transition-duration` to 0.01ms and `animation-iteration-count` to 1 for every element, so every class audited here (including the one fix) is already accessible to users with motion sensitivity without per-component opt-outs.

## Outcome

One fix shipped (`QuickMatchBanner.tsx`). The remaining 181 `animate-pulse`/`ping`/`bounce` instances and the sampled `animate-spin` instances are functioning as designed — gated to real loading/live/recording/celebration states, or (landing page / reward-tier cosmetics) explicitly out of this audit's scope. This is a materially different outcome than the gradient sweep (6 of 30 fixed): the animation system was already disciplined going in, so the audit's value here is the documented classification itself, not a large batch of fixes.
