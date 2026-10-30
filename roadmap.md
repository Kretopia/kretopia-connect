# Roadmap — Kreto + Credit Control (one pass)

Follow-up: backend-scoped ceiling, quota identity/read consistency, persisted openable attachments. No publication.

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
