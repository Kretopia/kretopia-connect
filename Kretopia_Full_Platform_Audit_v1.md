# Kretopia — Full Platform Audit v1.0

_Last audited: July 26, 2026_
_Scope: every pillar, every surface, current build state._

> Use this as the single source of truth for the YC application, the AI board (Claude + ChatGPT), and Kaen's onboarding. Everything below is grounded in what actually exists in the repo today — not the roadmap.

---

## 0. Platform Snapshot

| Metric | Value |
|---|---|
| Lines of code | ~279k |
| React pages | **149** |
| React components | **861** |
| Supabase edge functions | **299** |
| DB tables | ~340 |
| Vibe / theme | Locked to Midnight |
| Primary agent | **Kreto** (Executive Producer) |
| Brand system | Kretopia by Thrive Collective — Signal Triad + Ink |
| Ecosystem | Thrive Collective (parent) · Kretopia (platform) · Kretopia (community/events/magazine) · Kreto (AI EP) |

---

## 1. THE PASSPORT — "The IMDb + LinkedIn + Personal Site for creatives"

**What it is:** The creative's verified identity + résumé + hire-me page + shareable website — all one link.

### Built & working end-to-end
- **Creative Passport** (`/@handle`, `/profile`, `PassportRoute.tsx`) — public profile with identity, role, skills, socials, standing.
- **Stamps (verified credits)** — IMDb-style credit graph. Tables: `credits`, `credit_endorsements`, `credit_media`.
  - Fetch integrations LIVE: IMDb, Discogs, MusicBrainz, Spotify, YouTube, portfolio scrape (`fetch-*-credits`, `enrich-credits`).
  - Auto-thumbnail extraction (`scrape-thumbnail`, `backfill-credit-media`).
  - Categorization inference, featured pinning, tagged-non-user invites (viral loop).
- **Co-signs (vouches)** — one-tap share via WhatsApp / Email / Clipboard; guest verification via magic link (`CreditVerify.tsx`, `verify-credit`). No account needed to co-sign.
- **Press Kit / EPK** — portfolio, video intros, rate cards, press links, `epk-og-image` for social previews, PDF export (`epk-to-pdf-export`), one-link native share.
- **Creator Site / Website Builder** — IDE-style builder (`CreatorSite.tsx`, `generate-site`), DNS forwarding, `/@username` public URL, custom domain support.
- **Comp Card** — model-industry variant (`CompCard.tsx`, `CompCardBuilder.tsx`).
- **Booking page** — `/@handle/book` public booking, guest bookable, ties directly into Kretopia video calls with recording + Kreto transcription (verified working after RLS + HandleResolver fix).
- **Passport Anchor Strip** — 8 anchors (Standing · Stamps · Co-signs · Press Kit · Receipts · Wallet · Recent work · Verification) unifying Profile/Pay/Credits into one navigable spine.
- **Kretopia Verified** (formerly ICDB) — cross-referenced production database, roll call, production-detail pages, embeddable badge widget (HTML/Markdown/Shield.io).
- **Standing / Tiers** — verification score, level, XP, badge label (`badgeLabel.ts`), OG/Founding Member badges (135 OG cap locked).
- **Trust signals** — Reply SLA badge, Recently Worked With, Hire-Me Trust Bar, Booked This Month chip.

### What makes it unique
- One URL = résumé + portfolio + press kit + booking page + payment page. Nothing else in the creator space collapses those five surfaces.
- Every credit is **cryptographically co-signable by non-users** — turns the résumé into a growth engine.
- Automated professional discovery pre-builds unclaimed passports from public sources; creators "claim" (Wikipedia-style seeding).

### In pipeline
- Passport shareable video reel (Remotion pipeline exists in `/remotion` — not wired to Passport yet).
- Native mobile Passport (Capacitor scaffolded, not shipped).

---

## 2. KRETO — "Your AI Executive Producer"

**What it is:** Not a chatbot. A tool-calling operator that acts on the creative's behalf across every surface.

### Built & working end-to-end
- **Chat + voice** — `thrive-ai-chat`, `thrive-voice-turn` (ElevenLabs STT → Lovable AI → ElevenLabs TTS), push-to-talk in Kreto FAB. Tier-gated daily caps (`consume_copilot_message`, `consume_voice_seconds`).
- **9-tool agent** — draft_invoice, start_video_call, add_credit, send_dm, rsvp_event, vouch_credit, remember/recall/forget_memory (Phase 4 memory tools registered in `orch_tool_registry`).
- **Agent orchestrator** — planner (`copilot-planner`) → executor (`copilot-executor`) → collaborator tools. Multi-step plans with tool chaining.
- **Studio Brain** (EP 2.0) — `studio-ingest` unified router. Drop anything (PDF, image, voice note, email, link, deck, contract, budget, brief) → extracts to `studio_facts` + `studio_entities` per project. EP composes decks/proposals/treatments/rate cards/moodboards using memory, not prompts.
- **EP Document Engine** — `thrive-document-engine` (Gemini 2.5 Pro) with 8 design styles, self-scored quality grade (A+/A/B/C/D), real image library from brand assets + moodboards + project files, cover images, testimonials/team/timeline/process/financial/chart/gallery layouts.
- **Desk Agent Watch** — background watcher reads chat + state, inserts `agent_proposals` (5 kinds) as ProactiveCards.
- **Proactive Cards** — Home + Studio feed injection with Accept/Dismiss, Realtime auto-flow.
- **Voice-to-task** — mic FAB on Hub + Tasks composer; extracts title/due/assignee.
- **Pricing Co-pilot** — `ai-pricing-copilot` injects `thrive_memory` (rates/vendors/clients) into system prompt. Scan Brief button (camera/file → Gemini vision) drafts quotes.
- **Smart Gig Scout** (`scout-gigs`) — Firecrawl + Gemini fans out across LinkedIn/IG/ATS/60+ platforms, ranks fit, drafts application cover letter, daily cron 07:00 UTC.
- **Sponsor Radar** — Gemini 2.5 Pro tool-calling brand-lead detection.
- **Auto-EPK Updater** — background suggestions to refresh Passport when new signals detected.
- **Daily Intel Brief** — 08:00 UTC cron consolidating matches + gigs + money.
- **Inbox Triage Agent** — routes replies, drafts responses (`inbox-triage-agent`, `draft-lead-reply`).
- **Money Agent Watch** — invoice/expense/receipt awareness.
- **Community Call Brief Pipeline** — call recording → transcription → posts brief to Circle chat + DMs attendees + suggests spinning up a Studio when ≥2 collaborators detected.
- **Kreto Voice** — first-person, personable, no emojis, no "AI assistant" language.

### What makes it unique
- Grounded in **the creative's own memory** (`thrive_memory`, `studio_facts`) — vendors, rates, contacts, past decisions — not a generic LLM prompt.
- Same agent operates across **9 surfaces** (chat, voice, docs, scout, pricing, invoicing, calls, calendar, Passport updates). Nobody else has this footprint in the creator space.
- Every action is a real backend mutation, not a suggestion.

### In pipeline
- WhatsApp + Telegram channel bridge (Telegram MVP scaffolded in `telegram-*` functions; not launched).
- Autonomous "run overnight" mode (Creator+ gate exists, execution loop pending).
- Multi-agent handoff (specialist personas).

---

## 3. SCOUT — "Opportunity lives here"

**What it is:** AI finds real gigs across the web that fit the creative's Passport — not a job board with self-serve postings.

### Built & working end-to-end
- **Scouted gigs** (`/scout`, `scout-gigs`) — Firecrawl + Gemini scrapes 60+ sources (LinkedIn, IG, ATS, agency sites, casting boards). Ranks by `fit_score` against Passport.
- **Draft application** — `draft-gig-application` generates cover letter from Passport + gig context.
- **Scout preferences** — user tunes verticals, geography, comp thresholds.
- **Daily scout cron** — 07:00 UTC per active creator; results land in Scout tab.
- **Scout funnel instrumentation** — scouted / opened / drafted / apply_clicked / applied / won / lost / ghosted (admin dashboard via `get_scout_funnel_stats`).
- **Marketplace side (hybrid)** — human-posted paid + exchange gigs, JSON-LD schema, AI-enhanced descriptions (`enhance-gig`, `generate-gig-cover`), moderation (`gig-moderator`, `moderate-opportunity`).
- **Claim & Scout** — triple-layer fallback for gig sharing (`ClaimGig.tsx`, `verify-guest-opportunity`).
- **Scouted attribution** — "Scouted by Kreto" label, hides scout identity.
- **Talent Copilot / AI Talent Finder** — reverse Scout for hirers (`ai-talent-match`, `TalentCopilot`).

### What makes it unique
- Zero-effort inbound: creative logs in, real gigs are already waiting, ranked, with cover letters drafted.
- Scout crawls the actual open web — not just what someone posted on our marketplace.

### In pipeline
- Auto-apply (Creator+ only) with human-in-loop approval sheet.
- Priority queue for Creator+ (design done, ordering logic partial).

---

## 4. STUDIO — "Where creative projects actually get made"

**What it is:** A voice-first project workspace that replaces Slack + Notion + Trello + Drive for a single creative gig.

### Built & working end-to-end
- **Studio Room** (`StudioRoom.tsx`) — mobile single-scroll: NextStep bar → scroll-native task feed → chat → vault. Blocking tasks pinned, done auto-collapses.
- **Voice-first create** — VoiceFirstCreateModal ("What are you making?" → `extract-brief` → full scaffolded Studio).
- **Mood-tinted covers** — `moodGradient.ts` gives every Studio a signature look.
- **The Vault** — 4 auto-bootstrapped folders, pending-approvals pill, drag-drop uploads, storage-quota enforced by BEFORE INSERT trigger (`resolve_storage_owner` bucket-aware).
- **The Pad** — notes / docs collaboration.
- **Smart Brief Builder** — text/voice → `elevate-brief` → review sheet with assignee dropdowns → creates deliverables + tasks + notes + notifications in one shot.
- **Brief drop zone** — "Feed the Studio Brain" — accepts any file + paste-link → routes through `studio-ingest`.
- **Deliverables board** (desktop) — Kanban with moodboard thumbnails on cards.
- **Live presence + typing** — Realtime-broadcast throttled to 1.5s, TTL 4s.
- **@mentions with standout styling** — energy-lime border + "MENTIONED YOU" eyebrow.
- **Video calls in-Studio** — Daily.co, project rooms (10p), 1:1 from chat, guest links (`/call/:token`), global ringer via Realtime broadcast. Recording + transcription default on.
- **Studio Guest Access** — magic-link invites drop guests into the real Studio; `useStudioRole` gates Money (owner-only) + Kreto tools.
- **Frictionless import** — paste-link to Vault (`fetch-link-metadata`, OG scrape, YouTube oEmbed).
- **Workspace types** — general, event, photo, music, podcast, content, campaign, brand_campaign. Each has adaptive tools:
  - **Content Studio** — Shots · Script (versioned) · Calendar · Approve. `gen-content-shotlist` drafts 6–12 shots.
  - **Campaign Studio** — Brief (versioned) · Matrix · Approve. `gen-campaign-matrix` drafts 8–14 paid+organic assets.
  - **Music Studio** — Release · Tracks · Splits (live %) · Checklist. `gen-release-checklist` drafts 10–16 release tasks.
  - **Podcast Studio** — `podcast_episodes` + `gen-podcast-questions`.
- **Scope Guardian** — Risk Analyzer + Milestone Generator + Drift Detector via Gemini.
- **Auto-Accept invites** — role-aware (creative/client/collaborator) with inline accept banner on `/desk/:id`.
- **Public Studio recap** — shareable recap page.

### What makes it unique
- Every Studio has a **memory** (Studio Brain) — the deck it writes, the invoice it drafts, the moodboard it references are all grounded in what the creative dropped in.
- Voice is a first-class primitive from creation → tasks → docs.
- Same workspace handles a 4-hour photo shoot and a 6-month brand campaign — adaptive by workspace type.

### In pipeline
- Google Drive Picker (Phase 2 of frictionless import).
- Cross-Studio templates library.

---

## 5. KREPAY — "Get paid without an accounting team"

**What it is:** Invoicing + escrow + payouts + expenses, built for one-person creative shops in the Caribbean and globally.

### Built & working end-to-end
- **KrePay dashboard** (`/thrivepay`) — MoneyBrief hero, MoneyStreakChip, WeeklyMoneyInsights.
- **Money Streak** — `record_money_action` RPC tracks daily streak (invoice/expense/receipt).
- **Invoicing** — create, send (`send-invoice-email`), chase (`send-invoice-chase`), payment link (`create-invoice-checkout`, `PayInvoice.tsx`, guest checkout).
- **Milestone-based escrow** — full workflow (pending → in progress → review → completed → paid), 7-day hold, auto-capture on approval, refund on rejection. `create-milestone-payment`, `capture-milestone-payment`, `release-escrow`, `batch-milestone-payout`.
- **Stripe Connect (US/EU/global)** — controller account (`requirement_collection='stripe'`, `stripe_dashboard='none'`, `losses='application'`). Kretopia Wallet — creators add bank inline, no Stripe redirect, never see "Stripe."
- **PowerTranz (Caribbean)** — TTD/USD, full SPI integration.
- **Guest wallet** — `guest-wallet-me`, `guest-wallet-topup`, `guest-wallet-webhook` — pay without account.
- **AI Receipt Scanner** — Gemini vision + client-side compression (`scan-receipt`).
- **Currency conversion** — `convert-currency` edge fn, 1h client cache, dual USD/TTD display.
- **Payment Links** — Stripe-style checkout URLs (`create-payment-link-checkout`, `payment-link-info`).
- **Financial compliance limits** — `check_transfer_limit` enforces FIU reporting thresholds.
- **Get Paid Link** — `send-get-paid-link` one-tap "here's how to pay me."
- **Dispute resolution** — `auto-resolve-disputes`, `AdminDisputes`.

### What makes it unique
- Only creator platform with **built-in Caribbean payment rails** (PowerTranz + TTD/USD).
- Escrow flow that the client doesn't need an account for — pay via guest wallet.
- Kreto sees invoices/expenses and proactively drafts the next one.

### In pipeline
- Multi-currency payout beyond USD/TTD.
- Automated tax reports.

---

## 6. SOUND STAGES — "Live rooms, on air"

**What it is:** Spontaneous + scheduled live audio/video rooms for creatives. Not Clubhouse — tied to the Passport + Scout + Studio graph.

### Built & working end-to-end
- **Open Stage** (`/soundstages`, `create-sound-stage`) — spontaneous video/audio, formats: 1:1 / group / audience (up to 200). Daily.co backed, screen-share for all.
- **Backstage / soundcheck** — host solo before "Open the doors."
- **Speed Session** — admin-scheduled Hi-Right-Now-style 5-min rotating pairs (`/circle/speed/:id`). Greedy pairing avoids repeats.
- **Curated Stage** — ticketed panels (`create-curated-stage`, `checkout-stage-ticket`, `verify-stage-ticket`).
- **Raise hand / stage turns** — `raise-hand-stage`, `promote-raised-hand`, `start-stage-turn`, `end-stage-turn`.
- **Apply to stage** — `apply-to-stage`, `review-stage-application`, `invite-to-stage`.
- **Live captions + transcription** — host-toggled Daily `startTranscription()`, rolling 3-line overlay.
- **Recap with highlights + co-sign suggestions** — `transcribe-call` extracts clippable moments + co-sign candidates → DMs host `clip_suggestion` / `co_sign_suggested` nudges.
- **Group chat during stages**.
- **Stage reminders + RSVP** — `stage-reminders`, `rsvp-curated-stage`.
- **Sound Stages rail** — surfaces "on air now" across the platform.

### What makes it unique
- Stages feed the Passport (recorded moments become clippable co-sign candidates).
- Ticketed stages route through KrePay — creators get paid for panels.
- Speed Sessions solve the "cold connection" problem at industry-vertical granularity.

### In pipeline
- Scout Stages + Showcase Stages (Phase 2).
- Public share pages for live stages (`/live/:id` — designed, not shipped).

---

## 7. KRETOPIA — Community + Events + Magazine (retained sub-brand)

### Built & working end-to-end
- **Events** — full lifecycle: create, cover generation (`generate-event-cover`), reminders (24h/1h/recap/48h cron), waitlist trigger, RSVP RPC, promoter attribution (`?ref=`), dynamic OG image, live countdown, host trust card, .ics add-to-calendar, boarding-pass QR guest pass, IRL check-in via html5-qrcode, photo wall, auto Event Host credit, BringAFriendCard, event share pages (Vite plugin).
- **Circles (Communities/Crews)** — 7-tab hub, chat (`spark_rooms`), paid circles (`join-paid-circle`, `verify-circle-payment`).
- **Match** — Hinge-style one-card discovery, swipe/browse/network tabs, ThriveCredits separated, `generate-ice-breakers`, `generate-match-explanation`.
- **Magazine** — full CMS (`Magazine.tsx`, `MagazineArticlePage.tsx`, `compose-magazine-article`, `polish-magazine-article`, `og-magazine`, share pages).
- **Podcast** — `Podcast.tsx`, integrated with Podcast Studio.
- **ThriveFund** — creative funding campaigns (`Fund.tsx`, `thrivefund-*` functions, pledge/finalize/milestone-release).

### What makes it unique (as sub-brand)
- Community and events are the top-of-funnel; Kretopia (the platform) is where careers get built.
- Kretopia Verified (formerly ICDB) is the cross-referenced production DB.

---

## 8. CROSS-PLATFORM INFRASTRUCTURE

### Built & working
- **Auth** — Google + magic-link primary, password collapsed. Managed Supabase, auto-provisioning, OAuth consent screen (`OAuthConsent.tsx`) for MCP clients.
- **MCP server** (`src/lib/mcp/`, `supabase/functions/mcp`) — 5 tools exposed for external agents: `get_my_passport`, `list_my_credits`, `list_my_studios`, `list_scouted_gigs`, `search_creators`. **Edge function currently unstable — needs repair.**
- **Universal Search** — `universal-search`, Knowledge Cards, resilient fuzzy matching, cold-start Firecrawl parallel scraping.
- **Notifications** — unified routing via Postgres triggers → `action_url` deep-links, push (VAPID), email (Resend batched drip), in-app (`NotificationCenter`).
- **Realtime** — presence, typing, incoming calls, ProactiveCards injection, stage participants.
- **Storage** — unified quota (`storage_used_bytes` on profiles), tier caps 2GB/25GB/100GB/1TB, bucket-aware `resolve_storage_owner`.
- **Streaks** — `daily_streaks` + `bump_streak` RPC (login/copilot/profile_update).
- **Analytics** — internal `useSiteAnalytics`, `public-stats`, admin funnel dashboards.
- **Error monitoring** — `client_error_logs`, required `.catch()` blocks.
- **Localization** — react-i18next (en/es/fr), forced English default.
- **Caribbean voice layer** — geo+tone+opt-in copy (`useTrinidadVoice`).
- **PWA** — service worker, install prompt, push, offline network status.
- **Capacitor** — native iOS/Android scaffold (not shipped).
- **SEO** — dynamic share pages (Vite plugins: profile, event, gig, campaign, magazine), sitemap generation, JSON-LD.
- **Ambassadors** — `/ambassadors` waitlist + `/ambassador` hub with tier rewards at 5/25/100/500.
- **Founding Member** — `/founding-member` quest board, 135 OG cap, badge system.
- **Admin** — moderation, disputes, broadcasts, drip campaigns, feedback, funnel stats, weekly notes.

---

## 9. WHAT'S UNIQUE (elevator-pitch grade)

1. **The Creative Passport is the only creator identity that combines résumé + portfolio + press kit + booking + payment page under one URL, with co-signs anyone can grant.**
2. **Kreto is the only creator AI with cross-surface tool-calling AND grounded memory** (Studio Brain + thrive_memory). Not a chatbot — an operator.
3. **Scout is the only "opportunities inbox" that reads the open web** — not a job board with self-serve postings.
4. **Studio is the only creative workspace that adapts by project type** (content/campaign/music/podcast/event/photo) with a shared memory across all of them.
5. **KrePay is the only integrated creator invoicing + escrow + payout system with native Caribbean payment rails** (PowerTranz + Stripe Connect controller flow, guest-payable).
6. **Sound Stages is the only live-room product where every room feeds back into the Passport** (co-signs, clips, credits).
7. **The whole stack is agent-first** — every surface is a target for Kreto tool calls, exposed to external agents via MCP.

---

## 10. WHAT WORKS END-TO-END TODAY (green-light list for demo)

- Sign up → onboarding → Passport claimed → seeded demo Studio + 3 matches + 1 scouted gig (`seed_new_user_experience` RPC).
- Passport at `/@handle` — public, indexable, shareable, book meetings on it.
- Kreto chat + voice — real tool calls (draft invoice, start call, add credit, DM, RSVP, remember).
- Studio: voice-create → brief extraction → deliverables + tasks + moodboard + chat + video call + vault + memory-grounded EP deck.
- Scout: cron scrapes → ranks → drafts application → apply funnel tracked.
- KrePay: invoice → guest checkout → escrow milestone → payout to wallet.
- Sound Stages: create → live → record → transcribe → recap with co-sign suggestions.
- Events: create → RSVP → reminders cron → QR check-in → photo wall → auto Event Host credit.
- Co-sign: send WhatsApp link → guest verifies without account → credit endorsement recorded.
- Booking: guest visits `/@handle/book` → picks slot → Kretopia video call auto-created with recording + transcription.

---

## 11. IN PIPELINE (built but not shipped, or partial)

| Feature | Status |
|---|---|
| MCP edge function stability | Partial — needs repair |
| WhatsApp/Telegram Kreto bridge | Telegram scaffolded, not launched |
| Passport highlight reel (Remotion) | Pipeline exists, not wired |
| Native iOS/Android | Capacitor scaffolded |
| Scout auto-apply | Design done, execution loop pending |
| `/live/:id` public stage pages | Designed, not shipped |
| Google Drive Picker in Vault | Phase 2 |
| Multi-currency payouts beyond USD/TTD | Deferred |
| Autonomous overnight Kreto mode | Creator+ gate exists, loop pending |
| Cross-Studio templates library | Deferred |
| Scout Stages + Showcase Stages | Phase 2 |

---

## 12. HIDDEN / SUNSET (do not surface)

- Challenges & Rewards Shop — deleted, DB kept.
- "Standing" tier system — retired as a term.
- Kretopia as the platform brand — moved to community/events/magazine sub-brand.
- Izzy — renamed to Kreto everywhere.
- Communities as a discoverable feature — data retained, UI hidden.

---

## 13. HEALTH / READINESS

- **Codebase health:** 279k LOC, 861 components, no critical build errors. Schema drift on Home/Pay tables patched. RLS hardened (`public_profiles_safe` view for guest surfaces).
- **Rebrand completeness:** ~95% Kretopia surface language. Any remaining "Kretopia" refers correctly to the sub-brand.
- **Uniqueness moat:** Passport + Kreto + Scout + Studio + KrePay + Sound Stages — six defensible pillars, all live.
- **Public beta readiness:** GO for supply side (creators). Monetization on but low volume by design.

---

_This document supersedes `Kretopia_Product_Bible_v0.1`, `Kretopia_Technical_Snapshot_v0.1`, and the older Kretopia roadmap. Use this for YC W27 and all AI board briefings._

---

## Appendix: Unique Features Cheat Sheet (nothing left out)

A tight, scannable list of the things no other creator platform has stitched together the way Kretopia does. Use this for YC, the AI board, and Kaen's onboarding.

### Studio (workspace that morphs and remembers)
- **Adaptive workspace** — `projects.workspace_type` (`general | content | campaign | music | podcast | event | brand_campaign`) rewrites the Studio Room to the shape of the work: Shotlist/Script/Calendar/Approve for Content; Brief/Matrix/Approve for Campaign; Release/Tracks/Splits/Checklist for Music; Episodes/Questions for Podcast.
- **Studio Brain (EP 2.0)** — `studio-ingest` edge fn (Gemini 2.5 flash, tool-call `record_studio_brain`) is the unified router for every drop (PDF, image, voice note, email, link, deck, contract, budget, brief). Facts land in `studio_facts` + `studio_entities` per project.
- **Brief drop zone** — "Feed the Studio Brain" surface at the top of every Studio, mobile + desktop.
- **Smart Brief Builder** — text/voice → `elevate-brief` edge fn → review sheet with assignee dropdowns → auto-creates deliverables + tasks + notes + notifications.
- **Voice-to-task** — mic FAB on Hub + Tasks composer → `voice-to-task` (Gemini 2.5 flash) extracts title/due/assignee with a review sheet.
- **Scroll-native task feed** on mobile (Kanban on desktop) — blocking tasks pinned, done auto-collapses into a "Completed (X)" folder.
- **The Vault + The Pad + Moodboards** — versioned files, notes, and moodboards with paste-link import (`fetch-link-metadata` OG scrape + YouTube oEmbed).
- **Deliverables Board** with moodboard thumbnails on cards, WIP uploads to `project-files` bucket, quota charged to owner via `resolve_storage_owner`.
- **Guest access + magic-link invites** — clients/collaborators land in the real Studio; `useStudioRole` gates Money (owner-only) and Kreto (no clients/guests).
- **Live presence + typing** (Realtime broadcast) + @mention standout in Studio chat.
- **Public Studio Recap** share pages.
- **Desk Agent Watch** — `desk-agent-watch` edge fn reads chat + state and inserts `agent_proposals` (5 kinds) owners see as ProactiveCards with Accept/Dismiss and Realtime auto-injection.
- **EP Document Engine** — `thrive-document-engine` (Gemini 2.5 Pro) writes decks/proposals/treatments/rate cards/moodboards grounded in Studio Brain memory. Public share `/deck/:token`.

### Kreto (the agent with a brain and tools)
- **9-tool tool-calling agent**: `draft_invoice`, `start_video_call`, `add_credit`, `send_dm`, `rsvp_event`, `vouch_credit`, `remember_memory`, `recall_memory`, `forget_memory` (Phase 4 memory tools registered in `orch_tool_registry`).
- **Grounded long-term memory** — `thrive_memory` (vendors, sponsors, clients, rates) + `copilot_memories` (extracted stable preferences with pgvector dedupe via `match_copilot_memories`) injected into every reply.
- **Studio Brain-aware EP** — Kreto writes docs using project facts + entities, not just prompts.
- **Cross-surface Copilot** — one thread persists across Home, Desk, Pay, Match, Gigs, Profile, Credits, Events. Server hydrates history; client only sends the latest turn.
- **Push-to-talk voice** — `thrive-voice-turn` edge fn (ElevenLabs STT → Lovable AI → ElevenLabs TTS) with tier-gated daily seconds via `consume_voice_seconds` RPC.
- **Pricing Co-Pilot** — `ai-pricing-copilot` injects `thrive_memory` into the system prompt. "Scan Brief" button (camera/file → compressed JPEG → Gemini vision) drafts quotes as `draft_quote` tool.
- **Community Call Brief pipeline** — `daily-recording-webhook` → `transcribe-call` (Gemini 2.5 flash tool-call) → posts brief to Circle chat, DMs attendees, suggests "Create a Studio" when ≥2 collaborators detected.
- **Proactive nudges** — `desk-daily-nudge` cron at 14:00 UTC sends one consolidated push per user; ProactiveCards render pending proposals in-feed.
- **Sponsor Radar + Opportunity Intel** — daily digest (08:00 UTC), Gemini 2.5 Pro tool-calling for sponsor leads, Auto-EPK refresh suggestions.
- **Tier-gated daily caps** — `consume_copilot_message` RPC enforces Spark 20 / Pro 150 / Creator+ 500 / Founder 1000.

### Scout (real gigs, not a job board)
- `scout-gigs` (Firecrawl + Gemini) crawls web, LinkedIn, IG, ATSes for **real** creative gigs.
- `draft-gig-application` writes tailored cover letters grounded in the user's Passport.
- Daily cron 07:00 UTC. Scout Funnel instrumentation: scouted → opened → drafted → apply_clicked → applied → outcome (won/lost/ghosted).

### Passport (the Creative Record)
- `/@handle` public résumé + portfolio + press kit + rate cards + video intros.
- **Stamps** (credits) — verified via **magic-link co-signs** (WhatsApp/Email/clipboard, no account required to verify).
- **Vouches** (Gold/Amber ShieldCheck), Collab Graph, Kretopia Verified badge.
- Native Web Share API, EPK → PDF export (jsPDF multi-page), embeddable widget (HTML/Markdown/Shield.io).
- Anchor Strip surfaces Standing/Stamps/Co-signs/Press Kit/Receipts/Wallet/Recent work/Verification across /profile, /thrivepay, /credits.

### KrePay (frictionless money)
- **Kretopia Wallet (Phase 0)** — Stripe Connect controller with `stripe_dashboard='none'` → creators never leave Kretopia to onboard. Inline `<WalletAddBankSheet>`, no Stripe redirect.
- **Pricing Co-Pilot** drafts quotes/invoices from a photographed brief.
- **AI Receipt Scanner** (Gemini vision, client-side compression).
- **Money Streaks** — `record_money_action` RPC tracks daily streak from invoice/expense/receipt actions.
- **MoneyBrief** hero + `WeeklyMoneyInsights`, compact MoneyBrief on Home.
- PowerTranz SPI for TTD/USD (Caribbean payment rails).

### Sound Stages (spontaneous + scheduled rooms)
- **Open Stage** — spontaneous video/audio, 1:1/group/audience.
- **Speed Session** — admin-scheduled Hi-Right-Now-style 5-min rotating pairs, greedy matcher avoiding repeats.
- Daily.co room prefixes `ss-` / `sp-`. Live captions (3-line rolling), highlight extraction, co-sign suggestions from transcripts.

### Video Calls
- Daily.co — project rooms (10p), 1:1 from chat, guest links (`/call/:token`), global ringer via Realtime broadcast.
- Missed-call history (Calls tab in Messages), bandwidth fallback to audio, screen-share/recording toasts, Circle group calls.

### Booking + Personal Rooms
- Available times/days → client books → auto-provisions a Daily.co room with cloud recording + transcription on by default → Kreto processes the brief post-call and can propose a Studio.

### Retention loops
- **Unified Daily Streaks** (`daily_streaks` + `bump_streak` RPC: login/copilot/profile_update).
- **Founding Member Quest Board** (locked at 135 OGs, live progress).
- **Ambassador Program** (`?amb=CODE` attribution, tier rewards at 5/25/100/500).
- **Frictionless content import** — paste-link to Vault (`project_files.is_link`, OG scrape).

### Tone + surface polish
- `useAccountTone` (creative | business) drives copy + variants across nav, empty states, profile actions.
- `useTrinidadVoice` — geo + tone + opt-in — warm Caribbean voice on non-B2B surfaces only.
- Signal Triad brand system (Magenta · Yellow · Teal), Midnight vibe locked, `<BrandDots>` loader, `<KretoAvatar>` with halo.

### Infrastructure moat
- **MCP server** — external agents can call `search-creators`, `get-my-passport`, `list-my-studios`, `list-scouted-gigs`, `list-my-credits` via Supabase OAuth (`OAuthConsent.tsx`).
- **Dynamic OG image pipeline** for profiles/events/campaigns/gigs/decks.
- **Sanitized staging export** (`scripts/sanitized-export.sh`) — hashes user IDs, scrubs PII across 20 core tables.
- ~340 tables, 299 edge functions, Realtime + pgvector + RLS everywhere.

