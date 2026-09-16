---
name: Future Caribbean Buildathon — Application Draft
description: Kretopia application draft for the Future Caribbean 3-week buildathon (40 teams, 10 tracks, H200 GPUs, $70K prizes, NYSE finals).
type: reference
---

# Future Caribbean — Application Draft (v1)

> Primary track: **Creative Economy** · Secondary: **Workforce / MSME enablement**

## 1. Team

**Company:** Kretopia — The Creative Operating System
**HQ:** Port-of-Spain, Trinidad & Tobago (globally deployable)
**Founder:** [Founder name] — solo founder, technical, operating agentic AI in production today
**Domain:** https://kretopia.com · Demo: https://kretopia.com/demo/agent · Agent activity: https://kretopia.com/agents

## 2. One-line pitch

Kretopia is the agentic operating system for the global creator economy — Creative Passport (verified credits) + always-on agents that find, draft, negotiate and bank creative work.

## 3. The problem (Caribbean-sharp, globally true)

Caribbean creatives generate disproportionate cultural GDP (Carnival, music, film, fashion) yet:
- **Credits are invisible** — no IMDb for the 95% of creative roles outside Hollywood
- **Gigs are ghosted** — opportunities live in DMs, WhatsApp groups, scattered ATSs
- **Payments are late & cross-border-hostile** — TT/USD, no Stripe-native rails for most
- **Operations eat the margin** — proposals, quotes, invoices, follow-ups absorb 30-40% of a creative's week

The bottleneck is not talent. It's the **operational tax**.

## 4. The solution — agentic, not assistive

Kretopia runs a **fleet of specialised agents** on Lovable AI Gateway (Gemini Pro / 2.5 Flash / Flash Lite), each with a tool registry and persistent memory (`thrive_memory`):

| Agent | What it does autonomously |
|---|---|
| **Smart Gig Scout** | Crawls web, LinkedIn, IG, ATS daily; surfaces real gigs; drafts cover letters |
| **Desk-Agent-Watch** | Reads every studio's chat + state every 15-30min, posts proposals (5 kinds) |
| **Sponsor Radar** | Gemini 2.5 Pro tool-calling; generates qualified brand leads |
| **Pricing Co-Pilot** | Scans briefs, drafts quotes from creator's rate memory |
| **Studio Brain** | Ingests any drop (pdf/voice/image/email) → facts + entities the EP relies on |
| **Auto-EPK Updater** | Watches the Creative Passport for refresh signals |
| **Thrive Voice** | Push-to-talk operator (ElevenLabs STT/TTS), tier-capped |

Everything is observable at `/agents` (live agent_runs feed) and demonstrable at `/demo/agent` (no auth).

## 5. Track fit — Creative Economy

Direct fit:
- We are the **only Caribbean-built creator-economy platform with agentic AI in production**
- Creative Passport = verifiable credit graph, the data substrate the region lacks
- Open API surface (`orch_tool_registry`) — any third party can plug agents into our credit + payments graph
- Caribbean Carnival 2026 is a built-in showcase corridor

Secondary fit (Workforce / MSME):
- ThrivePay (Stripe Connect controller pattern, frictionless payouts) + invoicing already serve sole-prop creatives as a de-facto MSME OS

## 6. What we'll build in the 3 weeks (Buildathon scope)

1. **Open-source the Thrive Agent tool schema** — registry, memory, daily-caps, planner/executor pattern as a public Caribbean contribution
2. **Train a creative-economy reasoning model** on H200s, fine-tuned on the anonymised credit graph + scouted-gig outcomes (won/lost/ghosted)
3. **Agent observability dashboard** (`/agents` v2) — public-readable proof of autonomy at scale
4. **OpenClaw-compatible agent layer** so other Buildathon teams can call Kretopia agents as tools
5. **Live Carnival 2026 demo corridor** — onboard 50 verified Trinidad creatives during the buildathon

## 7. Why we win the NYSE finals

- Live product, real autonomous activity logged hourly (not a demo)
- Caribbean origin story + global TAM (every creator economy has the same problem)
- Agentic-first architecture predates the trend — we have the receipts in `agent_runs`
- Unit economics already work: Lovable AI Gateway + daily caps + tier billing

## 8. Ask

- H200 compute allocation for the reasoning model
- NYSE finals stage to launch the open agent schema
- Capital introductions for a Caribbean-rooted, globally-priced seed round

## 9. Links to verify

- Live agents feed: https://kretopia.com/agents
- Public demo (no auth): https://kretopia.com/demo/agent
- Founder kit: https://kretopia.com/founder-kit
- Metrics: https://kretopia.com/founder-kit/metrics
