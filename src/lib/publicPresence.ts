import { supabase } from "@/integrations/supabase/client";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

export interface PresenceResult {
  id: string;
  source: "kretopia" | "web";
  title: string;
  url: string;
  description?: string;
  kind: string;
}
export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
      host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
      !host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function normalizePresenceResults(rows: unknown[]): PresenceResult[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    const url = typeof r.url === 'string' ? publicSourceUrl(r.url) : null;
    if (!url || typeof r.title !== 'string' || !r.title.trim() || seen.has(url.replace(/\/$/, ''))) return [];
    seen.add(url.replace(/\/$/, ''));
    return [{ id: url, source: 'web' as const, title: r.title.slice(0, 200), url,
      description: typeof r.description === 'string' ? r.description.slice(0, 400) : undefined,
      kind: typeof r.type === 'string' ? r.type : 'Public source' }];
  }).slice(0, 20);
}
export async function searchPresence(query: string, signal: AbortSignal) {
  const q = query.trim();
  if (q.length < 2 || q.length > 200) throw new Error('Use between 2 and 200 characters.');
  if (/^https?:/i.test(q) && !publicSourceUrl(q)) throw new Error('Enter a public profile URL.');
  const [local, web] = await Promise.allSettled([
    supabase.from('public_profiles_safe').select('user_id, full_name, role, bio, location')
      .or(`full_name.ilike.${escapePostgrestValue(`%${q}%`)},role.ilike.${escapePostgrestValue(`%${q}%`)}`)
      .limit(20).abortSignal(signal),
    // A dedicated public endpoint, never the old unrestricted paid crawl.
    // Until its protected adapter is activated, failure is an honest partial result.
    supabase.functions.invoke('public-digital-presence', { body: { query: q }, signal }),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const localOk = local.status === 'fulfilled' && !local.value.error;
  const webOk = web.status === 'fulfilled' && !web.value.error && web.value.data?.available === true;
  const profiles: PresenceResult[] = localOk && local.status === 'fulfilled'
    ? (local.value.data || []).map(p => ({ id: p.user_id, source: 'kretopia', title: p.full_name || 'Passport',
      url: `/profile/${p.user_id}`, description: [p.role, p.location, p.bio].filter(Boolean).join(' · '), kind: 'Passport' })) : [];
  return { profiles, web: webOk && web.status === 'fulfilled' ? normalizePresenceResults(web.value.data.results || []) : [], localOk, webOk };
}
export function stagePresenceClaim(query: string, links: PresenceResult[]) {
  // Selection is intent, not identity or a verified credit. No database writes.
  sessionStorage.setItem('pending_presence_claim', JSON.stringify({ query, links, verified: false, ts: Date.now() }));
}