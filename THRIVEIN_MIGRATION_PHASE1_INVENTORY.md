# ThriveIN Legacy Migration — Phase 1 Inventory

Audit only. No files edited. Branch: `thrivinmigration` (main untouched, still at `23223524`).
523 raw case-insensitive hits for `thrive[-_]?in` across the repo, grouped below into 7 categories.

## ⚠️ Critical finding — read before Phase 2

**"ThriveIN" is not entirely legacy.** It is documented as an intentionally-retained sub-brand:

> `.lovable/memory/style/branding/kretopia-rebrand-v1.md`:
> — "**ThriveIN** = sub-brand for community, events, magazine, IRL meetups, dinners, SYNC. Used ONLY on those surfaces."
> — Listed as one of 8 official nav pillars: *Passport · Scout · Match · Studio · SoundStages · KrePay · Kreto · ThriveIN*
> — Explicit **"What NOT to rename (Phase 1)"** list: routes (`/thrive/*`, `/thrivepay`, `/desk/*`, `/circle/*`), DB tables (`thrive_documents`, `thrive_memory`, `thrive_intent_logs`), edge functions (`thrive-ai-chat`, `thrive-document-engine`, etc.), env vars, storage buckets, and the canonical domain (`thrivein-new-beta.lovable.app`, "until DNS points at kretopia.com").
> — Own migration plan explicitly defers backend renames: **"Phase 4 (not yet): backend rename (table/function rename — high risk, breaks share links)."**

`src/lib/brandLexicon.ts` (declared source of truth, "BRAND BIBLE v2") confirms the same principle in code: *"Routes, tables, edge functions still use thrive\_\* / izzy\_\* / etc. That's intentional — those are infrastructure names, not user-facing. Never surface them in UI."* It also confirms `agentName: "Kreto"` — a separate `.lovable/memory/style/branding/agent-name-izzy.md` note claiming the agent should say "Izzy" appears **stale**; the live edge-function system prompts already say "Kreto", matching the lexicon, not the Izzy note. Flagging as an unresolved stale-memory-file inconsistency — out of scope for this task, not touched.

**Practical effect:** of the 523 raw hits, roughly two-thirds are correctly-placed sub-brand/infrastructure references that should stay. The real "legacy debt" is smaller and concentrated in Groups D, E, and G below. Recommend confirming scope with the user before any Phase 2 edit — see "Open questions" at the end.

---

## Group A — Intentional sub-brand / infrastructure (DO NOT RENAME)

| Path | Symbol/Line | Category | Runtime impact | Backward-compat | Phase-2 safe? |
|---|---|---|---|---|---|
| `src/App.tsx:182,538` | `ThriveINTab` lazy import + `/thrivein` route | route | High — live route | N/A | **No — by design** |
| `src/pages/ThriveINTab.tsx` (whole file) | community hub page | route/UI | High — live, uses `BRAND.community` correctly | N/A | **No — by design** |
| `src/config/kretopiaV1.ts:19` | `thriveIN: { on: true, nav: true, contextual: true }` | feature flag | High | N/A | **No — by design** |
| `src/components/profile/ShareableCreatorCard.tsx:207` | `"THRIVEIN"` badge text | UI copy | Low | N/A | **No** — matches explicit rule: *"'Made with ThriveIN' on share pages is fine (platform attribution)"* |
| Magazine stack: `plugins/magazine-share-pages.ts`, `supabase/functions/og-magazine`, `polish-magazine-article`, `compose-magazine-article`, `generate-magazine-article` | "ThriveIN Magazine" branding | backend/UI copy | Medium (SEO/share cards) | N/A | **No — magazine is explicitly the sub-brand surface** |
| DB tables + all readers: `thrive_documents`, `thrive_memory`, `thrive_intent_logs` (`src/integrations/supabase/types.ts:17404`, `RecentIntentsDrawer.tsx:41`, `ThrivePromptHero.tsx:204,221,233`, `route-thrive-intent/*`, migration `20260506154657`) | table/column names | persisted state (DB schema) | High | N/A | **No — explicit "stays" + auto-generated types file, never hand-edit** |
| Edge function names: `thrive-ai-chat`, `thrive-document-engine`, `thrive-creative-tools`, `route-thrive-intent`, etc. | function slugs | backend/routing | High — URLs baked into client calls | N/A | **No — explicit "stays"** |
| `https://thrivein-new-beta.lovable.app` / `https://www.thrivein.io` used as **fallback** `origin`/`APP_URL`/`SITE_URL` in ~35 edge functions (Stripe checkout redirects, email links, invite links — full list in raw grep output, e.g. `create-invoice-checkout`, `wallet-topup`, `send-project-invitation`, `og-campaign`, `generate-sitemap`, `auth-email-hook`, `verify-brand-credit`, `verify-guest-opportunity`) | domain fallback | backend, payment/redirect-critical | High | N/A | **No — explicit "domain canonical stays until DNS points at kretopia.com"**. When that DNS cutover happens, this is ~35 near-identical literals that deserve one shared constant instead of hardcoding each — worth a hardening pass at that time, not now. |

---

## Group B — Ambiguous, needs a human decision (not touched, flagged per "do not guess")

| Item | What's ambiguous |
|---|---|
| `/thrivein` nav label | Three different labels in play for the same nav item: `KretopiaSidebar.tsx:19` hardcodes `label: "Kretopia"`; `brandLexicon.ts` defines `BRAND.pillars.community = "Community"`; the sub-brand concept itself is named "ThriveIN". None of the three files agree. Needs a product decision on the one correct current label, not a mechanical fix. |
| Agent name: "Kreto" vs "Izzy" | `agent-name-izzy.md` claims edge-function prompts already say "Izzy"; they actually say "Kreto" (matching `brandLexicon.ts`). The Izzy memory note looks stale/superseded. Unrelated to ThriveIN migration — flagging only, not in scope here. |
| `Auth.tsx:99` — `document.referrer.includes('thrivein')` | Live traffic-attribution logic (internal vs. external) keyed on a hardcoded domain substring. Not a copy fix — if/when the canonical domain changes, this check silently stops matching "internal" traffic. Real latent bug, separate from branding text. |

---

## Group C — High-risk backend items (explicitly NOT simple text edits)

| Path | Symbol/Line | Category | Runtime impact | Backward-compat | Phase-2 safe? |
|---|---|---|---|---|---|
| `supabase/functions/send-transactional-email/index.ts:8,12,16`, `supabase/functions/auth-email-hook/index.ts:39-41,48` | `SENDER_DOMAIN="notify.thrivein.io"`, `ROOT_DOMAIN`/`FROM_DOMAIN="thrivein.io"` | backend/email | **Critical** — live SPF/DKIM-verified sending domain | Yes | **No.** Changing this string without first verifying a new domain with the email provider (Resend) breaks *all* transactional email deliverability. Requires its own DNS/ESP-verification phase before any code change. |
| `supabase/functions/wallet-add-bank/index.ts:64`, `wallet-payout/index.ts:51` | `metadata: { thrivein_user_id: user.id }` | backend/persisted state in **external system** (Stripe) | High | Yes | **No.** This key already exists in Stripe's metadata for every Connect account created so far. A plain rename orphans existing records. Would need a dual-write/dual-read period, not a text swap. |
| `sso-authorize/index.ts`, `sso-userinfo/index.ts`, `THRIVEIN_SSO_DOCS.md` | "Sign in with ThriveIN" OAuth flow | backend/external API contract | High — documented partner integration ("Anansi") | Yes | **No.** This is a partner-facing brand contract, not just code. Renaming is a business/partnership decision (partner may have hardcoded expectations) before it's a coding task. |
| `supabase/migrations/*.sql` (e.g. `20260412200830_...sql:48-49`, `20260207065806_...sql:95`, `20260215103619_...sql:38`) | literal "ThriveIN" strings in historical seed data / column defaults | persisted state / DB history | Medium | Yes | **No — never edit already-applied migrations.** If defaults/seed text need updating, that's a new forward migration, not a rewrite of history. |

---

## Group D — Genuine legacy copy, safe category (but needs surgical per-line edits, not blind find/replace)

~25 edge functions mix a **safe** display-name occurrence with an **unsafe** domain occurrence in the same string literal, e.g.:
```ts
from: "ThriveIN <noreply@thrivein.io>",   // display name → Kretopia; domain stays (Group C)
```
Confirmed target pattern already exists in the same codebase — 5 functions already do exactly this split correctly:
`send-broadcast-email/index.ts:105`, `process-drip-campaign/index.ts:238`, `guest-wallet-session/index.ts:75`, `send-notification-email/index.ts:411`, `send-user-email/index.ts:291` all send from `"Kretopia <noreply@thrivein.io>"`.

Functions still needing the same split: `send-project-invitation`, `send-outreach-email`, `send-waitlist-invite`, `process-scheduled-campaigns`, `send-weekly-digest`, `send-activity-digest`, `send-founder-note-reminder`, `process-outreach-queue`, `send-invoice-email`, `send-get-paid-link`, plus display-only mentions (no domain in the string) in `telegram-webhook`, `feedback-chat`, `capture-milestone-payment`, `create-milestone-payment`, `create-payment`, `generate-deal-memo`, `send-phone-otp`, `send-push-notification`, `epk-og-image`, `event-og-image`, `project-og-image`, `agent-orchestrator`, `generate-challenges`, `generate-site`, `verify-profile`, `verify-credentials`, `validate-waitlist-ai`, `thrive-ai-chat` (the "...on ThriveIN" phrasing only, not the function name), `desk-agent` (same).

Plus `plugins/profile-share-pages.ts`, `gig-share-pages.ts`, `event-share-pages.ts`, `campaign-share-pages.ts`, `seo-pages.ts` (OG `site_name`/titles — NOT the magazine one, which is Group A).

Plus `remotion/src/scenes/{SceneHook,SceneSearch,SceneClose,SceneRollCall}.tsx`, `remotion/src/theme.ts` — marketing-video render text, zero app runtime risk, purely a content decision.

**Runtime impact:** Medium (user-visible emails/OG cards), not auth/payment-critical. **Backward-compat:** not required (display text only). **Phase-2 safe:** Yes, file-by-file, once Group C domain strings are confirmed to stay untouched in the same lines.

---

## Group E — Persisted client-side storage keys (real legacy naming, needs dual-read if renamed)

**localStorage** (persists indefinitely across sessions — renaming without a fallback read causes visible regressions for existing users):

| Key | File | Regression if renamed without fallback |
|---|---|---|
| `thrivein-nav-mode` | `src/hooks/useNavMode.ts:5`, read raw in `App.tsx:237` | Nav mode (create/work) silently resets |
| `thrivein-newsletter-dismissed` | `src/components/NewsletterPopup.tsx:9` | Dismissed popup reappears |
| `thrivein-pwa-prompt-dismissed` | `src/components/PWAInstallPrompt.tsx:6` | Dismissed install prompt reappears |
| `thrivein_amb_code_persist` | `src/lib/ambassadorAttribution.ts:10`, `AmbassadorAttributionVerifier.tsx:90` | Ambassador attribution lost |
| `thrivein_bonus_{userId}_{feature}`, `thrivein_usage_{userId}_{feature}` | `src/hooks/useFeatureUsage.ts:23-24`, `WalletXPSection.tsx:87` | Usage/bonus counters reset |
| `thrivein_discovery_unlocked_{userId}` | `CircleBrowseGrid.tsx:36` | Unlocked state resets |
| `thrivein.guestWalletToken` | `src/lib/guestWallet.ts:7` | Guest loses wallet session (real financial feature — balance itself is server-side/email-tied, so not destructive, but forces re-verification) |
| `thrivein_last_signin_method` | `src/lib/authProviderHints.ts:5` | Minor UX (loses "continue with X" hint) |
| `thrivein_exchange_rates` | `src/hooks/useCurrencyConversion.ts:39` | None — self-healing cache |
| `thrivein_lang` | `src/i18n/index.ts:26` (`lookupLocalStorage`) | Language preference resets |

**sessionStorage** (tab-scoped, cleared on tab close — lower but non-zero backward-compat risk, only matters for a tab mid-flow across a deploy):

| Key | Files (read+write confirmed consistent) |
|---|---|
| `thrivein_post_auth_redirect` | `AuthPrompt.tsx:27`, `ProfileLaunchScreen.tsx:129,132`, `Auth.tsx:53,59,148`, `SpeedSession.tsx:90`, `JoinGuestStudio.tsx:43` — **this is the one named explicitly in the user's Phase 2 instructions as auth-redirect-critical** |
| `thrivein_pending_claim`, `thrivein_pending_claim_full` | `AuthContext.tsx:102-124`, `AuthPrompt.tsx:33`, `ProductionPage.tsx:144`, `CreditVerify.tsx:86,287`, `EmailSaveStep.tsx:50,190` |
| `thrivein_pending_post` | `QuickPostModal.tsx:91`, `src/lib/pendingPost.ts:5,7` |
| `thrivein_amb_code` | `AmbassadorAttributionVerifier.tsx:89`, `ambassadorAttribution.ts:8` |
| `thrivein_draft_opportunity` | `src/pages/PostOpportunity.tsx:19` — storage API (local vs session) not yet confirmed, needs one more read before Phase 2 |

**Keep, not legacy:** `src/components/settings/CreatorSiteSettings.tsx:19` — `"thrivein"` appears in a **reserved-subdomain blocklist**. This intentionally stays forever; it blocks users from claiming that word as their own creator subdomain. Not a branding reference.

**Adjacent, out of strict scope:** `src/components/project/InvoiceGenerator.tsx:86` uses `thrive_invoice_draft_*` (no "in") — surfaced by the broader regex, technically outside "ThriveIN" scope.

**Runtime impact:** Medium. **Backward-compat:** required for all of the above. **Phase-2 safe:** yes, but only using the read-old/write-new/fallback-read pattern the user's own instructions specify — never a plain rename.

---

## Group F — Legacy docs / notes (zero runtime impact)

~35 root-level markdown files are pure historical/planning documentation: `SUBSCRIPTION_GUIDE.md`, `FUNCTION_SECURITY_MATRIX.md`, `BETA_LAUNCH_CHECKLIST.md`, `THRIVEIN_SSO_DOCS.md`, `MONITORING_SETUP.md`, `EDGE_FUNCTION_MANIFEST.md`, `SITE_STATUS.md`, `BETA_AUDIT.md`, `IRL_FEATURES.md`, `PLATFORM_AUDIT_2026.md`, `INVESTOR_DECK_350K.md`, `PLATFORM_HEALTH_CRITICAL_REPORT.md`, `PLATFORM_HEALTH_REPORT.md`, `LAUNCH_CHECKLIST.md`, `Kretopia_Full_Platform_Audit_v1.md`, `PLATFORM_AUDIT_2025.md`, `LAUNCH_READINESS_REPORT.md`, `MVP_OPTIMIZATION_PLAN.md`, `INVESTOR_DECK_V2.md`, `INVESTOR_DECK_V3.md`, `STRATEGIC_MVP_PLAN_2025.md`, `SECURITY_AUDIT_2026.md`, `PLATFORM_IMPROVEMENT_PLAN.md`, `FIXES_COMPLETED.md`, `AI_FEATURES.md`, `ACTIVATION_MODEL.md`, `FEATURE_AUDIT.md`, `INVITE_MATERIALS.md`, `COMPREHENSIVE_PLATFORM_AUDIT_2025.md`, `CONVERSION_OPTIMIZATION_REPORT.md`, `ANALYTICS_EVENT_TAXONOMY.md`, `FUNNELS.md`, `LAUNCH_VALIDATION_CHECKLIST.md`, `ANALYTICS_DASHBOARD_PLAN.md`.

Plus `.lovable/plan.md` and `.lovable/memory/strategy/{founder-bio.md, applications/bridge-for-billions.md, applications/future-caribbean.md, applications/founder-institute.md}` — these reference "ThriveIN" as the company's **actual founding/legal name and history** (V1 2020, V2 2023, Trinidad & Tobago origin). Editing these would make the historical record factually wrong, not cleaner.

**Recommendation:** don't text-edit these at all. If repo clutter is the real concern (`PLATFORM_AUDIT_2026.md` itself flags "158 routes, 291 edge functions... built faster than consolidated" sprawl), archive to a `/docs/archive/` folder rather than editing in place. That's a separate decision from this migration.

---

## Group G — Assets/downloads (dead-code candidates, not yet proven unreferenced)

| Files | Size | References found |
|---|---|---|
| `src/assets/thrivein-{icon.png, logo.png, credits-launch.jpg, credits-launch-v2.jpg, credits-launch-v3.jpg, credits-launch-v4.jpg, evolution-post.jpg}` | ~2.5MB total | **Zero** imports found anywhere in `src/` |
| `public/downloads/ThriveIN-{Documents-Bundle.zip, Response.docx, Full-Platform-and-Context.docx}` | ~64KB total | **Zero** links found in `src/`, `supabase/`, or root docs |

Only checked `src/`, `supabase/`, and root `*.md` — not proven unreferenced against 100% of the codebase (e.g. not checked for external links, or references embedded in migration seed data). Per the user's own Phase 3 rule ("prove unreferenced status before deleting"), these are candidates only — need one more verification pass before any deletion, which is explicitly Phase 3, not now.

---

## Root-config sweep (clean)

Checked `index.html`, `public/manifest.json`/`site.webmanifest`, `public/robots.txt`, `vite.config.ts`, `.env.example` — zero hits in any of them.

---

## Open questions before Phase 2

1. **Scope confirmation** — given Group A, does "migrate remaining ThriveIN legacy references" mean Groups D/E/G only (the genuinely stale ~40% of hits), or does it mean overriding the `kretopia-rebrand-v1.md` sub-brand plan itself? I'd default to the former (respecting the existing internal plan) unless told otherwise.
2. **Email sending domain (Group C)** — is `thrivein.io` / `notify.thrivein.io` still the live, DNS/SPF/DKIM-verified sending domain today? If yes, it must stay untouched regardless of any other decision here.
3. **SSO partner (Group C)** — is the "Anansi" SSO integration still active? If yes, any rename needs partner coordination, not just a code change.
4. **`/thrivein` nav label (Group B)** — which of "Kretopia" / "Community" / "ThriveIN" is the currently-correct label? Three files disagree.

Nothing has been edited. Ready to scope Phase 2 to whichever subset you confirm.
