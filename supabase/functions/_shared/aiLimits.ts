// Centralized max_tokens budgets for Lovable AI Gateway calls, mirroring how
// aiModels.ts centralizes model strings -- one place to tune a tier instead
// of a scattered literal per call site.
//
// A Phase 0 audit of all ~113 edge functions calling the gateway found only
// a handful set any max_tokens at all, so most calls had no real ceiling on
// generation length or cost. These values are intentionally generous (3-5x
// the typical real output for their tier) so they function as a runaway-
// generation safety net, not a tight content limit -- the goal is to stop
// a malformed/looping response from burning unbounded tokens, not to
// shorten normal output. Only add a tier here once you've confirmed what
// it covers; don't add one speculatively for a use case nothing calls yet.

// Single classification label (one of a small fixed set) plus a short
// one-sentence reasoning string, as plain text or a small JSON object.
// Typical real output is well under 50 tokens.
export const TOKENS_SHORT_LABEL = 200;
