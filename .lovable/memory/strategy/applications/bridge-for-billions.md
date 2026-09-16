---
name: Bridge for Billions — Application Draft
description: Kretopia application drafts for Bridge for Billions, both Planting Seeds (idea-stage) and Conecta Caribbean (growth-stage / EU+IDB Lab CARIBEquity) tracks.
type: reference
---

# Bridge for Billions — Application Draft (v1)

> Submitting to **Conecta Caribbean** (growth-stage, EU + IDB Lab CARIBEquity-aligned) as the primary track. Planting Seeds answers retained below in case the program reroutes.

---

## A. Conecta Caribbean (primary)

### A1. Company snapshot
- **Name:** Kretopia
- **HQ:** Trinidad & Tobago
- **Stage:** Post-MVP, paying users, active OG cohort (capped at 135), Founding Member tier live
- **Sector:** Creative economy / agentic AI / fintech for creators
- **Website:** https://kretopia.com

### A2. Problem
Caribbean creative workers — musicians, filmmakers, designers, Carnival mas-makers, content creators — generate outsized cultural exports yet have no operating layer. Credits are unverified, gigs are ghosted in DMs, payments cross borders badly, and admin work eats 30-40% of billable time. The same gap exists across LATAM, Africa and Southeast Asia.

### A3. Solution
Kretopia is the **Creative Operating System** — a Creative Passport (verified credits + co-signs), Smart Match (creators ↔ opportunities), Smart Gig Scout (real gigs found daily by agents), ThriveDesk (project workspace with an autonomous Desk-Agent), and ThrivePay (Stripe Connect frictionless payouts with TT/USD support).

A fleet of agents (Gemini Pro / 2.5 Flash) runs continuously: scouting, drafting, pricing, watching every studio, surfacing sponsor leads, refreshing EPKs. Activity is observable at `/agents`.

### A4. Traction (verify before submit)
- Active OG cohort (135 capped) + Founding Member tier
- Verified Creative Passports in production
- Smart Gig Scout ingesting real gigs across web, LinkedIn, IG, ATS daily
- ThriveDesk studios with autonomous agent proposals
- ThrivePay live (Stripe Connect controller pattern, TT/USD currency conversion)
- Caribbean-first deployment via kretopia.com custom domain
- (Insert MRR / active-users / GMV numbers from `/founder-kit/metrics`)

### A5. Business model
Subscription tiers (Spark / Creator / Creator+ / Founding) + employer-pays platform fee on paid gigs + ThrivePay transaction margin. Daily agent caps protect unit economics; Founding Member ($499 lifetime) bypasses standard billing.

### A6. EU + IDB Lab CARIBEquity alignment
- **Caribbean-rooted, female-and-diaspora-friendly creative workforce** is the primary served population
- **Formalisation of the creative MSME sector** is the direct outcome — ThrivePay turns sole-prop creatives into invoice-issuing, tax-trackable businesses
- **EU Global Gateway / IDB Lab innovation theses** map cleanly onto agentic-AI productivity uplift in an underserved sector

### A7. Specific incubation asks
1. Mentor matching on **EU market entry** (Spain, Portugal, France creative economy bridges)
2. Structured **MSME impact measurement** framework — so we can publish Caribbean creative-economy GDP uplift
3. Investor introductions for a **Caribbean-rooted seed round** with EU and IDB Lab co-investment
4. ESO partnerships across Jamaica, DR, Barbados, Guyana for regional rollout

### A8. 6-month incubation goals
- Onboard 1,000 verified Caribbean creatives across 6 countries
- Publish first Caribbean Creative Economy Index (anonymised credit + earnings graph)
- Close priced seed round
- Open Spanish + Portuguese language layers via `react-i18next` infrastructure already in place

---

## B. Planting Seeds (fallback / if rerouted)

### B1. Idea in one sentence
Kretopia turns the chaotic, ghosted, under-paid life of a creative worker into an operating system run by always-on AI agents.

### B2. Why now
LLM-powered agents are the first technology that can absorb a sole proprietor's operational tax at sole-proprietor unit economics. The creator economy is now a $250B+ market with no native operating layer.

### B3. Why us
Solo technical founder operating agentic AI in production today; Caribbean origin gives us the world's hardest test conditions (bandwidth, cross-border payments, fragmented gig discovery). If it works here, it ships anywhere.

### B4. What we need from Planting Seeds
- Validation rigour on Caribbean diaspora ICP
- Mentor coverage on agentic-product pricing
- Structured weekly accountability through to seed-readiness

---

## C. Shared answers (reusable across both tracks)

**Founder bio:** see `mem://strategy/founder-bio.md` (short bio + Caribbean roots paragraph).

**Why agentic, why now:** Operational tax on creatives is 30-40% of billable time. Agents are the first tech that absorbs it economically. Our agents are in production with observable run logs at `/agents`.

**Risks & mitigations:**
- Model cost drift → daily caps per tier (`consume_copilot_message`, `consume_voice_seconds` RPCs)
- Hallucination on credits → strict extractive model, never generative for the credit graph (see `ai-data-integrity-and-hallucination-prevention` memory)
- Cross-border payments → PowerTranz SPI for TTD/USD already live; Stripe Connect for global
