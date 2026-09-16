// Shared embedding helper for Thrive Brain.
// Uses Lovable AI Gateway → Google text-embedding-004 (768-dim).
// Returns null on failure so callers can degrade gracefully.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "google/text-embedding-004";

export async function embedText(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.warn("embedText: LOVABLE_API_KEY missing");
    return null;
  }
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!trimmed) return null;

  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: trimmed }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.warn("embedText non-OK", resp.status, t.slice(0, 200));
      return null;
    }
    const json = await resp.json();
    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== 768) {
      console.warn("embedText: unexpected embedding shape", vec?.length);
      return null;
    }
    return vec as number[];
  } catch (e) {
    console.warn("embedText error", e);
    return null;
  }
}

/** pgvector accepts the literal `[0.1,0.2,...]` text format for vector columns. */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
