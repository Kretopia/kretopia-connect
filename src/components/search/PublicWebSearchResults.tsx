import { useEffect, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KretopiaSpinner } from '@/components/brand/KretopiaLoader';
import { supabase } from '@/integrations/supabase/client';
import { normalizePresenceResults, PUBLIC_WEB_SEARCH_ENABLED, type PresenceResult } from '@/lib/publicPresence';

/** Adds sources inside the existing dropdown; never replaces its field or local results. */
export function PublicWebSearchResults({ query }: { query: string }) {
  const [rows, setRows] = useState<PresenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setUnavailable(false);
    setLoading(false);
    if (!PUBLIC_WEB_SEARCH_ENABLED || query.trim().length < 2 || query.length > 200) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('public-digital-presence', {
          body: { query: query.trim() }, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (error || data?.available !== true) setUnavailable(true);
        else setRows(normalizePresenceResults(data.results ?? []));
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 900);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  if (!PUBLIC_WEB_SEARCH_ENABLED || (!loading && !unavailable && !rows.length)) return null;
  return <div className="order-3 border-t border-border py-2">
    <p className="px-4 pb-1 text-xs font-semibold text-muted-foreground">Public web</p>
    {loading && <div role="status" className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"><KretopiaSpinner className="h-4 w-4" />Searching the web</div>}
    {unavailable && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Web search temporarily unavailable</p>}
    {rows.map(row => <Button key={row.id} variant="ghost" asChild className="h-auto w-full justify-start gap-3 rounded-none px-4 py-2 text-left">
      <a href={row.url} target="_blank" rel="noopener noreferrer" data-search-result>
        <Globe className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.title}</span><span className="block truncate text-xs text-muted-foreground">{new URL(row.url).hostname}</span>{row.description && <span className="block whitespace-normal text-xs text-muted-foreground line-clamp-2">{row.description}</span>}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
      </a>
    </Button>)}
  </div>;
}