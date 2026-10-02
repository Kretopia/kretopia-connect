// Wrap a fetch with a hard timeout so a single upstream call can never hang
// an edge function past its wall-clock budget (Supabase edge functions run
// on a ~150s limit). The timer is cleared as soon as fetch() resolves, which
// happens once response headers arrive -- for a streaming response this
// bounds time-to-first-byte, not total streaming duration, so a slow-but-
// actively-streaming reply is never aborted mid-stream.
//
// Extracted from agent-orchestrator's original local copy so every function
// calling an external AI gateway can share the same guard instead of each
// reimplementing (or omitting) one.
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(id);
  }
}
