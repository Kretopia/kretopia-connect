/**
 * Public Web + AI search is hosted on the separate Lovable Cloud backend, never on the legacy
 * production backend. Only the publishable (browser-safe) key is used here; the endpoint enforces
 * its own server-only activation switch and atomic global quota.
 */
const SEARCH_BACKEND_URL = "https://czpucbhnmcudggydwxlg.supabase.co";
const SEARCH_BACKEND_PUBLISHABLE_KEY = "sb_publishable_ssXNn-GlHaO9CYIjNj_URg_jQFG1Vep";

export interface PublicWebSearchResponse {
  available: boolean;
  results?: unknown[];
  aiAvailable?: boolean;
  phase?: 'web' | 'complete';
}

export const PUBLIC_WEB_SEARCH_DEBOUNCE_MS = 250;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: PublicWebSearchResponse; expires: number }>();
type Listener = (data: PublicWebSearchResponse) => void;
const pending = new Map<string, { promise: Promise<PublicWebSearchResponse>; listeners: Set<Listener>; latest?: PublicWebSearchResponse }>();

export function getCachedPublicWebSearch(query: string): PublicWebSearchResponse | undefined {
  const key = query.trim().toLowerCase();
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  cache.delete(key);
}

async function fetchSearch(query: string, publish: Listener): Promise<PublicWebSearchResponse> {
  const response = await fetch(`${SEARCH_BACKEND_URL}/functions/v1/public-digital-presence`, {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/json", apikey: SEARCH_BACKEND_PUBLISHABLE_KEY },
    body: JSON.stringify({ query, stream: true }),
  });
  if (response.ok && response.body && response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latest: PublicWebSearchResponse = { available: false, results: [] };
    const consume = (line: string) => {
      if (!line.trim()) return;
      const data = JSON.parse(line) as PublicWebSearchResponse;
      if (typeof data.available !== 'boolean') return;
      latest = data;
      publish(data);
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(consume);
        if (done) break;
      }
      consume(buffer);
    } catch (error) {
      // Already received real sources remain usable if ranking disconnects.
      if (!latest.available) throw error;
      latest = { ...latest, phase: 'complete', aiAvailable: false };
    } finally {
      reader.releaseLock();
    }
    return latest;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") return { available: false, results: [] };
  return data as PublicWebSearchResponse;
}

/** Share public-only requests across Hero/navbar; consumer cancellation never cancels another subscriber. */
export async function invokePublicWebSearch(query: string, signal?: AbortSignal, onUpdate?: Listener): Promise<PublicWebSearchResponse> {
  const q = query.trim();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (q.length < 2 || q.length > 200) return { available: false, results: [] };
  const cached = getCachedPublicWebSearch(q);
  if (cached) return cached;
  const key = q.toLowerCase();
  let request = pending.get(key);
  if (!request) {
    const listeners = new Set<Listener>();
    const entry = { listeners, promise: Promise.resolve({ available: false } as PublicWebSearchResponse), latest: undefined as PublicWebSearchResponse | undefined };
    entry.promise = fetchSearch(q, data => {
      entry.latest = data;
      entry.listeners.forEach(listener => listener(data));
    }).then(data => {
      if (data.available) {
        if (cache.size >= 40) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
      }
      return data;
    }).finally(() => pending.delete(key));
    request = entry;
    pending.set(key, request);
  }
  const active = request;
  return new Promise((resolve, reject) => {
    const listener: Listener = data => { if (!signal?.aborted) onUpdate?.(data); };
    const cleanup = () => { active.listeners.delete(listener); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    active.listeners.add(listener);
    signal?.addEventListener('abort', abort, { once: true });
    if (active.latest) listener(active.latest);
    active.promise.then(data => { cleanup(); resolve(data); }, error => { cleanup(); reject(error); });
  });
}
