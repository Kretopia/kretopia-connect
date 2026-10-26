export interface PublicWebResult { title: string; url: string; description: string; type: string }

export function sourcedPublicResults(value: unknown): PublicWebResult[] {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (typeof r.title !== 'string' || !r.title.trim() || typeof r.url !== 'string') return [];
    try {
      const url = new URL(r.url);
      const host = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
          !host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
          /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return [];
      url.hash = '';
      const key = url.href.replace(/\/$/, '');
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ title: r.title.slice(0, 200), url: url.href,
        description: typeof r.description === 'string' ? r.description.slice(0, 400) : '', type: 'Public source' }];
    } catch { return []; }
  }).slice(0, 20);
}

/** AI may rank actual sources, never add a URL, identity or unsourced biography. */
export function rankPublicSources(sources: PublicWebResult[], indices: unknown): PublicWebResult[] {
  if (!Array.isArray(indices)) return sources;
  const ordered = [...new Set(indices.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < sources.length))];
  return [...ordered.map(i => sources[i]), ...sources.filter((_, i) => !ordered.includes(i))];
}