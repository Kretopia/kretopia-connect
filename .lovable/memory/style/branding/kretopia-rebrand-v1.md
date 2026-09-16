---
name: Kretopia Rebrand v1
description: Thrive→Kretopia platform rebrand. Ecosystem map, agent rename to Kreto, Kretopia as sub-brand, what NOT to rename.
type: design
---

# Kretopia Rebrand v1 (supersedes brand-bible-v1 naming)

## Ecosystem
- **Thrive Collective** = parent company. Legal / footer only ("Kretopia by Thrive Collective").
- **Kretopia** = the platform. The Creative Economy OS.
- **Kretopia** = sub-brand for community, events, magazine, IRL meetups, dinners, SYNC. Used ONLY on those surfaces.
- **Kreto** = the AI Executive Producer. Replaces all user-facing "Thrive" / "Izzy" agent references.

## Positioning
- Emotional: "Welcome to Kretopia. Where Creativity Lives."
- Functional: "The Creative Economy OS. Build your profile. Find opportunities. Collaborate. Get paid."

## Pillars (nav-facing labels)
Passport · Scout · Match · Studio · SoundStages · KrePay · Kreto · Kretopia

## Source of truth
`src/lib/brandLexicon.ts` — `BRAND.*`, `BRAND.pillars.*`, `KRETO_VOICE`. `THRIVE_VOICE` aliased for back-compat. Always import from here, never hardcode.

## Visual
- Wordmark: lowercase `kretopia` with "to" tinted signal-teal (#17D9D4). BrandDots Signal Triad unchanged (magenta/yellow/teal).
- Vibe: midnight default (deep midnight / dark graphite). Avoid crypto / gaming / AI-robot aesthetics.

## What NOT to rename (Phase 1)
- Routes: `/thrive/*`, `/thrivepay`, `/desk/*`, `/circle/*` all stay. UI labels reflect new brand.
- DB tables: `thrive_documents`, `thrive_memory`, `thrive_intent_logs`, etc. stay.
- Edge functions: `thrive-ai-chat`, `thrive-document-engine`, `thrive-voice-turn`, etc. stay.
- Env vars and storage buckets: unchanged.
- Domain canonical: stays `kretopia.com` until DNS points at kretopia.com.

These are infrastructure names — never surface them in UI. When in doubt, label with `BRAND.*`.

## Agent voice (Kreto)
Producer, manager, connector, strategist, mentor. Never "AI assistant / chatbot / bot / copilot". Examples in `KRETO_VOICE.good`.

## Migration path
Phase 1 (shipped): lexicon, BrandLogo, index.html meta + JSON-LD, hero copy.
Phase 2 (not yet): audit remaining "Thrive" mentions in landing sections, emails, ProductSectionThrive → ProductSectionKreto, ThriveDeskShowcase headlines, agent FAB labels, drawer titles.
Phase 3 (not yet): route aliases /kretopia/* + /kreto/* with redirects.
Phase 4 (not yet): backend rename (table/function rename — high risk, breaks share links).
