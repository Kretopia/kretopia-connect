# Roadmap — Kreto + Credit Control (one pass)

## Temporary transparent Halloween mascots
- [x] Use supplied transparent pumpkin on Landing with the existing flight controller, timing and scroll movements unchanged; aligned wave layers retain the greeting.
- [x] Repair witch cauldron and residual background; use it on the existing KretoAI launcher without cropping.
- [x] Verify flight through 11 browser transforms using actual CDN file bytes, image transparency, and launcher open event; 54 tests pass, managed build OK; no publication.
- [ ] Verify real signed-in KretoAI opening: no Cloud auth users available to mint a session. Local browser cannot serve CDN URLs directly; verified with fetched originals intercepted at their exact asset URLs.

## Security lockdown (October 31 continuation)
- [x] 1. Shared request guard implemented; obsolete Studio tutorial assertion aligned without changing UI; 3,427 tests pass and managed build OK. Existing consume_ai_feature_call is not concurrency-safe in repository SQL; strict rate limiting remains provisional.
- [ ] 2. Edge perimeter now covers 14 handlers, including nine additional Inbox/listing/markup/Studio/gig generators. Handler suite: 121 behavioral tests; all 3,554 full-suite tests pass with four workers; nine additional Deno checks and managed build OK. Remaining endpoint inventory still needs per-caller review: 276 literal wildcard-CORS entrypoints remain, plus SDK-imported headers; do not blanket-gate public, voice/media or internal callers. No deployment; live legacy verification requires deployment access/session.
- [x] 3. SSRF: the five functions fetching caller-supplied links (profile import/analyze, thumbnail scrape, EPK avatar) now use safeFetch with per-hop private-address checks, redirect caps and timeouts; EPK avatars also limited to image types under 2 MB. Regression test added; 436 security/edge tests pass. Not deployed.
- [ ] 4. Exposed endpoint removal and authentication hardening. Done: every entrypoint now has an access check (only public sitemap open by design); VAPID key generator removed; last three plain secret comparisons made constant-time; regression test added. Remaining: live 401 checks need deployment.
- [ ] 5. CSP, safe links, HTML sanitation, QR print safety. Done: app-wide unsafe-link guard (javascript:/data: blocked, new tabs get noopener), baseline CSP (object-src none, base-uri self, upgrade-insecure), creator-site embeds no longer accept inline styles; tests added. QR payloads now restricted to absolute http(s) (safeQrPayload + test). Remaining: full script-src CSP needs a header-level policy after inventorying third parties.
- [x] 6. Patched dependencies and audit: 272 → 71 advisories; jsPDF 4.2.1 (shipped critical fixed), vitest 3.2.6; only remaining critical is tinypool inside the test runner (not shipped). Four stale wiring tests updated; book-meeting no longer returns internal error text.
- [ ] 7. Read-only policy audit: Cloud done (docs/security/POLICY_AUDIT_2026-10-31.md); username attempt limiter fix applied at user request and verified. Legacy backend audit blocked: no read access from here.
- [ ] 8. Final verification: 342 files / 3,585 tests pass. Remaining: live 401/413/429 matrix needs deployed functions; legacy backend unverified.
SQL must stay files only; no publication or legacy deployment. Full tests run per step; build/typecheck are managed by the preview harness.

Follow-up: backend-scoped ceiling, quota identity/read consistency, persisted openable attachments. No publication.

- [x] Guard optional username linking with live account validation, retain server 401 protection, and allow retry after failed linking. 19 tests pass; authenticated end-to-end check still awaits an available session, no publication.

- [x] Fix check-subscription authentication failures in source: reject absent/deleted/foreign sessions with 401 and prevent background calls with an unvalidated session. 27 tests pass; payment behavior unchanged.
- [ ] Apply the function's auth-only fix on the backend serving the failing call and verify a real signed-in session; legacy deployment access/session unavailable here. No unrelated Cloud/payment deployment.

- [x] Correct onboarding links, align the welcome screen with Kretopia, and navigate to Passport immediately after a confirmed profile save. Browser layout and automated handoff checks; no publication.
- [ ] Verify the accepted invitation with a real session; managed Cloud still reports no auth users on October 30.

- [x] Add provider receipt accounting and centralized workspace pricing; real gateway probe matches 0.000412 credits. Reservations remain estimates, never recorded charges.
- [x] Enumerate uncapped legacy/downstream paths in docs/product/MEASURED_AI_ACCOUNTING.md; complete shared gating not claimed.
- [x] Explain minimum Cloud test-account step: More → Users → Add user → Send invitation, accept invitation.
- [ ] Authenticated reply and actual ledger delta: blocked until one real Cloud account exists; legacy coverage also needs deployed receipt support/access.

- [x] Explain measured daily ceiling versus request average; no legacy automation changes.
- [x] Align Cloud quota reads and enforcement; document exact denial path.
- [x] Persist extracted text and original reference linked to message; TTL, open and delete paths; tests.
- [ ] Real connected-account test: quota denials and upload → send → reopen → open → delete. Blocked by unavailable legacy test session; required before reliance/publication.

- [x] P1: ai_credit_ledger / ai_credit_envelope / ai_credit_config + try_reserve/commit/release/get_ai_credit_overview RPCs; gate in _shared/aiRateLimit.ts
- [x] P2: thrive-ai-chat reserve/commit/release, model routing, max_tokens; InlineKretoChat draft preservation + retry
- [x] P3: system prompt rewrite (EP voice, ≤120 words, tag protocol kept)
- [x] P4: attachments (PDF/image/txt, 3×10MB, server-side parse, KretoComposerAttach)
- [x] P5: autocomplete ghost text (250ms debounce, 2s timeout, 24 tokens, silent fail)
- [x] P6: Match 1/day + stored reuse; Scout 1/day + 24h cache; envelope first
- [x] P7: KretoQuotaIndicator, allowance/budget denial copy, Admin → AI Credits tab, limits in ai_credit_config
