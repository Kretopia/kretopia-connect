import { useEffect, useState } from 'react';
import { Check, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KretopiaSpinner } from '@/components/brand/KretopiaLoader';
import { getCachedPublicWebSearch, invokePublicWebSearch, PUBLIC_WEB_SEARCH_DEBOUNCE_MS } from '@/lib/publicWebSearchEndpoint';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizePresenceResults, PUBLIC_WEB_SEARCH_ENABLED, type PresenceResult } from '@/lib/publicPresence';

/** Adds sources inside the existing dropdown; never replaces its field or local results. */
export function PublicWebSearchResults({ query }: { query: string }) {
  const [rows, setRows] = useState<PresenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState(query);
  const valid = query.trim().length >= 2 && query.length <= 200;
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setUnavailable(false);
    setLoading(false);
    setRanking(false);
    setResolvedQuery(query);
    if (!PUBLIC_WEB_SEARCH_ENABLED || query.trim().length < 2 || query.length > 200) return;
    const cached = getCachedPublicWebSearch(query);
    if (cached) { setRows(normalizePresenceResults(cached.results ?? [])); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await invokePublicWebSearch(query.trim(), controller.signal, update => {
          if (controller.signal.aborted) return;
          if (update.available) setRows(normalizePresenceResults(update.results ?? []));
          setRanking(update.phase === 'web');
        });
        if (controller.signal.aborted) return;
        if (data?.available !== true) setUnavailable(true);
        else setRows(normalizePresenceResults(data.results ?? []));
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setRanking(false); }
      }
    }, PUBLIC_WEB_SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  if (!PUBLIC_WEB_SEARCH_ENABLED || !valid) return null;
  const current = resolvedQuery === query;
  const visibleRows = current ? rows : [];
  const waiting = !current || loading;
  // One element carries the whole state: the Globe logo, the label ("Parsing
  // Web" while working, "Public web" once settled) and the count on the right.
  // A second status row under the header used to break the dropdown's rhythm.
  return <div className="order-3 border-t border-border py-2">
    <div role="status" aria-live="polite" title={ranking ? `${visibleRows.length} sources found · AI ranking` : undefined} className="flex items-center justify-between gap-2 px-4 pb-2">
      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold"><Globe className="h-3.5 w-3.5 shrink-0 text-foreground" /><span className="k-gradient-text truncate">{waiting ? 'Parsing Web' : 'Public web'}</span>{waiting && <KretopiaSpinner className="h-3.5 w-3.5 shrink-0" />}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">{waiting ? <><Sparkles className="h-3 w-3" />AI</> : unavailable ? 'Unavailable' : <><Check className="h-3 w-3" />{visibleRows.length ? `${visibleRows.length} sources` : 'None'}</>}</span>
    </div>
    {waiting && !visibleRows.length && <div aria-hidden="true" className="space-y-3 px-4 py-2">{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-3 motion-reduce:animate-none"><Skeleton className="h-7 w-7 shrink-0 rounded-md motion-reduce:animate-none" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-3/4 motion-reduce:animate-none" /><Skeleton className="h-2 w-1/2 motion-reduce:animate-none" /></div></div>)}</div>}
    {visibleRows.map(row => <Button key={row.id} variant="ghost" asChild className="h-auto w-full justify-start gap-3 rounded-none px-4 py-2 text-left">
      <a href={row.url} target="_blank" rel="noopener noreferrer" data-search-result>
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.title}</span><span className="block truncate text-xs text-muted-foreground">{new URL(row.url).hostname}</span>{row.description && <span className="block whitespace-normal text-xs text-muted-foreground line-clamp-2">{row.description}</span>}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
      </a>
    </Button>)}
  </div>;
}