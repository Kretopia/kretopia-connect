// Shared call logic for buildathon-sponsor AI providers (Nebius, MiniMax).
// Both expose an OpenAI-compatible chat-completions shape per their public
// docs, so one adapter covers both -- each function just supplies its own
// endpoint/model/body-shape.
//
// No credentials are configured for either provider yet. When the API key
// env var is absent, this returns a clearly-labeled mock response instead
// of calling out -- never fabricate a "live" result without one.

export interface AIProviderRequest {
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface AIProviderResult {
  text: string;
  mode: "mock" | "live";
  model?: string;
  latencyMs: number;
}

interface CallOptions {
  apiKey: string | undefined;
  endpoint: string;
  model: string;
  mockText: string;
  buildBody: (req: AIProviderRequest, model: string) => unknown;
  extractText: (json: any) => string;
  timeoutMs?: number;
  maxRetries?: number;
}

export async function callAIProvider(req: AIProviderRequest, opts: CallOptions): Promise<AIProviderResult> {
  const start = Date.now();

  if (!opts.apiKey) {
    return {
      text: `[MOCK — ${opts.model}] ${opts.mockText}`,
      mode: "mock",
      model: opts.model,
      latencyMs: Date.now() - start,
    };
  }

  const maxRetries = opts.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
    try {
      const res = await fetch(opts.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opts.buildBody(req, opts.model)),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        lastError = new Error(`Provider responded ${res.status}`);
        // Don't retry client errors other than rate-limiting.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        await backoff(attempt);
        continue;
      }

      const json = await res.json();
      return {
        text: opts.extractText(json),
        mode: "live",
        model: opts.model,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      await backoff(attempt);
    }
  }

  // Log enough to debug, never the key itself.
  console.error("[aiProviderAdapter] call failed", {
    endpoint: opts.endpoint,
    model: opts.model,
    attempts: maxRetries + 1,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  throw new Error("AI_PROVIDER_UNAVAILABLE");
}

function backoff(attempt: number): Promise<void> {
  const ms = Math.min(1000 * 2 ** attempt, 4000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
