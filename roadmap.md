# Roadmap — Kreto + Credit Control (one pass)

Follow-up: backend-scoped ceiling, quota identity/read consistency, persisted openable attachments. No publication.

- [ ] Explain measured daily ceiling versus request average; no legacy automation changes.
- [ ] Align Cloud quota reads and enforcement; document exact denial path; authenticated verification remains a release prerequisite.
- [ ] Persist extracted text and original reference linked to message; TTL, open and delete paths; tests.

- [x] P1: ai_credit_ledger / ai_credit_envelope / ai_credit_config + try_reserve/commit/release/get_ai_credit_overview RPCs; gate in _shared/aiRateLimit.ts
- [x] P2: thrive-ai-chat reserve/commit/release, model routing, max_tokens; InlineKretoChat draft preservation + retry
- [x] P3: system prompt rewrite (EP voice, ≤120 words, tag protocol kept)
- [x] P4: attachments (PDF/image/txt, 3×10MB, server-side parse, KretoComposerAttach)
- [x] P5: autocomplete ghost text (250ms debounce, 2s timeout, 24 tokens, silent fail)
- [x] P6: Match 1/day + stored reuse; Scout 1/day + 24h cache; envelope first
- [x] P7: KretoQuotaIndicator, allowance/budget denial copy, Admin → AI Credits tab, limits in ai_credit_config
