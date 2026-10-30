# Roadmap — Kreto + Credit Control (one pass)

Target: Lovable Cloud backend (only deployable backend). Measured peak daily AI spend: 0.167 credits (2026-10-27, 33 reqs) → envelope cap baseline.

- [ ] P1: Ledger migration — ai_credit_ledger, ai_credit_envelope, ai_credit_config + try_reserve/commit/release/status RPCs (security definer, RLS locked)
- [ ] P1: Extend _shared/aiRateLimit.ts with reservation gate (keep existing limiter intact)
- [ ] P2: thrive-ai-chat — reserve before model call, commit on success, release on fail/abort; model routing + max_tokens caps
- [ ] P2: InlineKretoChat — failed call keeps draft, real error, retry
- [ ] P3: System prompt rewrite — EP voice, opinions, ≤120 words, keep action/plan protocol
- [ ] P4: Attachments — PDF/images/txt, 3 files × 10MB, server-side PDF text extraction, attachment_parse charged at upload, removable chips (new component: KretoComposerAttach)
- [ ] P5: Autocomplete — ghost text, 250ms debounce, 2s timeout, 24 tokens, flash-lite, silent fail
- [ ] P6: Match 1/day + reuse stored; Scout 1/day + 24h cache; Kreto message+token budget; envelope first
- [ ] P7: KretoQuotaIndicator component; allowance vs budget denial copy; Admin read-only credit section; limits in ai_credit_config
- [ ] Verify: build, targeted tests, RPC concurrency check, function deploy + curl smoke
- [ ] Report per phase + max 3 open questions
