---
name: Passport profession archetypes + Standing v2
description: Profession-aware Passport layouts (Model/Photographer/Musician/Filmmaker/Designer/Writer/Creator/Crew) inferred from profiles.role + sub_roles, overridable via profiles.passport_profession. Standing computed from credits+cosigns+completion+activity (5 levels: Newcomer→Marquee). Components: PassportHeroRibbon, LevelUpCard, PassportShareSheet. Libs: src/lib/passport/{professionProfiles,standing,shareTargets}.ts.
type: feature
---
Passport-first overhaul (Phase 1).

**Profession layouts** — `src/lib/passport/professionProfiles.ts` exports `PROFESSION_LAYOUTS` keyed by 8 archetypes + `default`. Each defines `heroVariant`, `primarySections`, `secondarySections`, `hiddenSections`, `shareTargets`, `tagline`. `inferProfession(profile)` resolves the key from `passport_profession` override → role/sub_roles regex match → `default`.

**Standing v2 (canonical level system)** — `src/lib/passport/standing.ts`. ONE level system across the platform. Legacy `tierSystem.ts` / `xpSystem.ts` / `gamification.ts` DELETED. `computeStanding({ verifiedCredits, recentCredits90d, cosignsReceived, profileCompletionPct, activeProjects90d, replySlaHours, lastActivityAt, verificationScore, unclaimed })` returns `{ level 0-5, title, score, progressPct, nextLevelTitle, nextActions[], gatedAt, gateReason, decaying, unlocks[] }`. Levels: L0 Unclaimed (pre-claim only), L1 Newcomer (0), L2 Working Creative (30), L3 Verified Pro (75), L4 Industry Name (140), L5 Marquee (220). Weights: cosigns ×6 (capped at 10 unique), credits ×4, recent credits ×2, completion ×0.3, active projects ×3, <24h reply +5. **Decay**: dormant 180d+ → score × 0.85, surfaced as "Slipping" banner on LevelUpCard. **Verification gate**: L3+ require `verification_score >= 60`; if score qualifies but verification doesn't, `gatedAt` is set and user sees "Finish verification to claim X" CTA. **Unlocks** (display-only v1): L2=Listed in Discover, L3=Scout priority + Verified EPK badge, L4=Featured Discover + press-kit badge, L5=Top of Match queue + Marquee mark.

**Share targets** — `src/lib/passport/shareTargets.ts` maps `ShareTarget` → `{label, description, href(userId), paidOnly}`. Site target is `paidOnly: true` (gated to Creator+).

**Components** in `src/components/passport/`:
- `PassportHeroRibbon` — thin ribbon above profile hero, title + progress bar.
- `LevelUpCard` — Home + Profile card with top 3 next actions.
- `PassportShareSheet` — profession-aware share order, native share + WhatsApp + Email.

**DB** — `profiles.passport_profession text null` added. Null = inferred.

**ProfileActions** — added "Publish as Website" / "Edit Website" overflow entry (gated by `canPublishSite` prop; falls back to /subscription upsell).
