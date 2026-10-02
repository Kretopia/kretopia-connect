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

// A short prose draft explicitly bounded to a handful of sentences in its
// own prompt (a bio, a gig description, a daily-briefing line, a chat reply,
// a negotiation/outreach message) -- typical real output is 50-180 tokens.
// Not for anything whose real length is open-ended or caller-controlled
// (a voice transcript, a document, a multi-paragraph draft).
export const TOKENS_SHORT_DRAFT = 500;

// A structured JSON object with a handful of scalar/short-string fields,
// optionally including one small bounded array (a short fixed-size list, or
// a pick from a small fixed set of category tags) -- typical real output is
// 80-250 tokens. Not for a field whose length genuinely scales with the
// input (e.g. "every line item on this receipt", "every name on this page")
// -- capping that risks truncating mid-JSON and breaking the parse entirely,
// which is worse than no cap; that case needs its own sized-for-the-input
// budget, not this tier.
export const TOKENS_STRUCTURED_SMALL = 600;
