# Kretopia Feature Bible — Team Reference Document

A single document your team can read to understand every feature, why it exists, how a user experiences it, and where we're going next with Kreto and AI.

## What gets produced

One artifact, written to `/mnt/documents`:

- `Kretopia_Feature_Bible_v1.docx` — formatted, brand-styled, ready to share with the team, investors or new hires.
- A markdown twin (`Kretopia_Feature_Bible_v1.md`) so it can be pasted into Notion/Slack and edited.

No code or backend changes.

## Structure

1. **What Kretopia is** — the Creative Economy OS. Positioning, the emotional line ("Where Creativity Lives"), the functional line, launch markets.
2. **The brand in one page** — Signal Triad colours, Midnight default vibe, typography, wordmark, Kreto vs Kretopia vs Thrive Collective naming rules, and what we never say.
3. **The lexicon** — Creative Passport, Stamps, Co-sign, Press Kit, Receipts, Calls, Put Forward, Rolodex. What each term means and the plain-English equivalent.
4. **Feature-by-feature chapters.** For each: what it is in one line, the user problem, the user journey step by step, what's live today, what's AI-powered, and what's next. Chapters:
   - Creative Passport (identity, standing, professions, holo card, public EPK, share)
   - Stamps & Credits (claim, tag, co-sign/verify loop, disputes, the Credits dashboard)
   - Scout (opportunity discovery, drafting, funnel, apply)
   - Match & Circle (discovery, swipe, network, connections, messaging)
   - Studio / Desk (workspaces, brief drop, Studio Brain, tasks, vault, workspace slices: content, campaign, music, podcast, event)
   - Sound Stages & Calls (open stages, speed sessions, video calls, recording, transcription, briefs)
   - KrePay (invoices, receipts, wallet, payouts, escrow status)
   - Search & the public graph (people, credits, projects, SEO/crawlability, MCP)
   - Kretopia community surfaces (events, magazine, spotlight, perks, ambassadors, founding member)
5. **Kreto — the brain.** The agent's identity and voice, what it can actually do today (tool inventory: drafting, memory, proposals, document engine, pricing, voice), how approvals work, how memory works, the model map, and the daily caps by tier.
6. **What makes us unique** — the moat argument: verified record + co-sign graph + execution layer in one place, and why each competitor (LinkedIn, Behance, Upwork, IMDb, Notion/Slack) only holds one piece.
7. **Where the platform is going** — a research-backed section (see below).
8. **Appendix** — surface map (route → feature → owner), tier/limits table, glossary.

## Research pass

Before writing section 7, research current AI/creator-platform state of the art and translate findings into concrete Kretopia opportunities: agentic workflows and computer-use agents, generative video/image in creative production, verified-credential and reputation systems, AI-native search and answer engines, on-platform monetisation and instant payouts, voice-first interfaces, and what comparable platforms shipped recently. Each finding lands as "what's happening → what Kretopia should do → effort/impact".

## Technical notes

- Sources: `.lovable/memory/**`, `src/lib/brandLexicon.ts`, `src/config/kretopiaV1.ts`, route table in `src/App.tsx`, edge-function inventory in `supabase/functions/`, and existing audit markdown at repo root.
- Feature status labels are derived from what's actually in the codebase (live / partial / flagged off / planned), not aspiration.
- Generated with python-docx using brand colours and Inter; every page rendered to image and visually QA'd before delivery.
- Hidden/legacy surfaces are listed in the appendix as "code retained, not in nav" so the team doesn't rediscover them by accident.
