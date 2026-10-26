import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, ArrowLeft, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KretopiaSpinner } from '@/components/brand/KretopiaLoader';
import { searchPresence, stagePresenceClaim, type PresenceResult } from '@/lib/publicPresence';

export function PublicPresenceSearch({ initialQuery = '', onContinue }: { initialQuery?: string; onContinue?: () => void }) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [details, setDetails] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchPresence>> | null>(null);
  const [selected, setSelected] = useState<PresenceResult[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(5);
  const request = useRef<AbortController>();
  useEffect(() => () => request.current?.abort(), []);
  const submit = async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setResult(null); setSelected([]); setCount(5);
    try { setResult(await searchPresence([query, details].filter(Boolean).join(' '), controller.signal)); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search unavailable. Please try again.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const claim = () => {
    stagePresenceClaim(query, selected);
    onContinue?.();
  };
  if (preview) return <section className="space-y-4 text-left" aria-label="Passport preview">
    <Button variant="ghost" size="sm" onClick={() => setPreview(false)}><ArrowLeft className="mr-2 h-4 w-4" />Results</Button>
    <div className="border-y border-border py-5 space-y-3">
      <p className="k-gradient-text font-semibold">Kretopia Passport · Preview</p>
      <h2 className="text-xl font-semibold break-words">{query}</h2>
      <p className="text-xs text-muted-foreground">Ownership not verified</p>
      {selected.map(r => <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="flex gap-2 text-sm text-foreground break-all underline underline-offset-4"><ExternalLink className="h-4 w-4 shrink-0" />{r.title}</a>)}
    </div>
    {onContinue ? <Button className="w-full" onClick={claim}>Join Kretopia</Button> : <Button asChild className="w-full"><Link to="/auth?tab=signup&mode=classic" onClick={claim}>Join Kretopia</Link></Button>}
    <p className="text-xs text-muted-foreground">Selected sources remain unverified. Account access does not prove ownership of these links.</p>
  </section>;
  return <section className="space-y-4 text-left" aria-label="Discover your digital presence">
    <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">Discover your digital presence</label>
      <Input id={id} value={query} onChange={e => { request.current?.abort(); setBusy(false); setResult(null); setError(''); setQuery(e.target.value); }} maxLength={200} placeholder="Search your name, username, or paste a public profile URL" className="h-12 text-base bg-transparent" />
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Refine your search</summary><Input value={details} onChange={e => setDetails(e.target.value)} maxLength={100} aria-label="Profession, city, company or username" placeholder="Profession, city, company or username" className="mt-2 bg-transparent" /></details>
      <Button type="submit" disabled={busy || query.trim().length < 2} className="w-full gap-2 h-11">{busy ? <KretopiaSpinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}Find my passport</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <div aria-live="polite" className="space-y-4">
      {[{title:'Kretopia', rows:result.profiles}, {title:'Public web',rows:result.web}].map(group => <section key={group.title} className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">{group.title}</h3>
        {group.title === 'Public web' && !result.webOk ? <p role="status" className="text-sm text-muted-foreground">Web search is temporarily unavailable</p> : group.title === 'Kretopia' && !result.localOk ? <p className="text-sm text-muted-foreground">Kretopia search is temporarily unavailable</p> : group.rows.length === 0 ? <p className="text-sm text-muted-foreground">No matching sources</p> : group.rows.slice(0,count).map(r => <div key={r.id} className="flex items-start gap-3 border-b border-border py-3">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={selected.some(s => s.id === r.id)} aria-label={`Select ${r.title} from ${r.source}`} onChange={e => setSelected(prev => e.target.checked ? [...prev,r] : prev.filter(s => s.id !== r.id))} />
          <div className="min-w-0 flex-1"><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold flex items-start gap-2 break-words">{r.title}<ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" /></a><p className="text-xs text-muted-foreground break-all">{r.source === 'web' ? new URL(r.url).hostname : 'Kretopia'} · {r.kind}</p>{r.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>}</div>
        </div>)}
      </section>)}
      {Math.max(result.profiles.length,result.web.length) > count && <Button variant="ghost" onClick={() => setCount(c => c + 5)}>Load more</Button>}
      {selected.length > 0 && <Button variant="outline" className="w-full gap-2 whitespace-normal h-auto min-h-11" onClick={() => setPreview(true)}><Fingerprint className="h-4 w-4 shrink-0" />Is this you? Claim your passport</Button>}
    </div>}
  </section>;
}