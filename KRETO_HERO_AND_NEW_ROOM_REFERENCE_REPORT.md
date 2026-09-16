# Kreto Hero + New Room — Reference and Rights Report

## Status: `AUDITED`. Rights decision: reference images are `UNKNOWN_RIGHTS_ORIGIN` — reference language only, not cleared production assets. No implementation should reproduce their geometry.

## What was inspected

- The "Meet Kreto" character-sheet image shared earlier in this conversation (main pose + four small icon variants: Scout, Connector, Producer, Publicist).
- `~/Desktop/KRETOPIA/WhatsApp Image 2026-09-06 at 18.44.57.jpeg` — same image, found on disk. The filename itself (`WhatsApp Image...`) is evidence of provenance: it arrived via a WhatsApp forward, not as an original design file with production metadata (contrast with `kretopia-wordmark.png` / `logokretopia.png` in the same folder, which read as first-party brand assets). This does not prove the image is third-party, but it does mean nothing in this repository or its adjacent asset folder establishes team ownership, a license, or an artist credit for it.
- `Kretopia_Kreto_Evolution_Brief_v1.docx` — re-read for this pass. Still explicitly calls the reference material "Blinky-style... refine before locking," i.e. the team's own document treats it as a mood reference, not a locked, cleared design.
- `KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md` and `KRETO_ORIGINALITY_AND_REFERENCE_REPORT.md` — the two prior rights decisions in this codebase, both classifying an earlier reference image the same way (`UNKNOWN_RIGHTS_ORIGIN`).

## What the reference actually shows (for audit purposes, not reproduction)

A glossy, pale/cream-white plastic-shell character with a large rounded head, a dark visor containing two paired crescent-shaped glowing eyes (pink-to-orange gradient), one arm raised in a wave, a gradient "K" mark on the chest, and soft pink/purple rim lighting typical of AI-rendered "friendly companion robot" mascot art. The four small variants reuse the same core head/shell/eyes and add a held prop (magnifying glass, network-node icon, tablet, megaphone) to signal role.

This is a widely-seen genre of character design (the cute, wide-eyed white/pastel companion-bot look appears across many stock and AI-generated mascot assets and strongly evokes a specific, recognizable commercial character silhouette in that genre). Its origin cannot be confirmed as team-owned or licensed from anything in this repository. Per the standing project rule (already applied to the prior reference and unchanged by this pass), it is treated as **reference language only**.

## Decision

Unchanged from the existing `KretoPresence` design, and reconfirmed applicable to this new brief's Hero/New Room work:

```text
graphite / near-black material language      -- NOT the reference's pale/white shell
warm off-white panels (accent only)          -- NOT a body wash
real Kretopia K-mark (via KretoMark, as-is)  -- same treatment already in place
one restrained signal-dot cue                -- NOT the reference's paired crescent eyes
pink only as a controlled accent             -- NOT a rim-light glow around the whole body
```

No new geometry, proportions, visor shape, pose, or material pattern from the reference image should be copied into any Hero-scene or New Room work. The existing `KretoPresence` component already embodies this divergence correctly (confirmed by re-reading `src/components/brand/KretoPresence.tsx` in full during this pass) and needs no redesign for rights reasons — only the new work items below (Hero scene, `listening` state) need to be built to the same standard.

## New elements this brief introduces that are NOT derived from the reference at all

The Hero "scattered work → Passport → Credits → opportunity" narrative calls for abstract fragments: cards, proof nodes, line connections, a Passport silhouette, project/credit shapes. None of these have any relationship to the reference character image — they are original UI/data-visualization elements in Kretopia's own existing visual language (the signal-field gradient, the coordinate grid, the K-mark already used in the Hero). This part of the work carries no rights exposure at all; it just needs a design/implementation pass (see `KRETO_HERO_SCENE_REPORT.md`).

## No third-party asset used as a production asset (confirmed, unchanged)

Re-confirmed for this pass: no file from `~/Desktop/KRETOPIA/` (including the WhatsApp image) is referenced anywhere in `src/`. The only image asset `KretoPresence`/`KretoMark` render is the pre-approved `kretopia-k-mark.png`.
