import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Sparkles, ShieldAlert, X } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RescanAllLinksCardProps {
  profile: any;
  onRefresh: () => void;
}

type Platform = 'imdb' | 'youtube' | 'spotify' | 'behance' | 'soundcloud' | 'vimeo' | 'website';

// IMDb/YouTube/Spotify's edge functions insert/upsert into `credits`
// server-side (confirmed: supabase/functions/fetch-{imdb,youtube,spotify}-credits
// write to the table themselves before returning) -- the frontend never
// sees a pre-write moment to gate, so these three can only get an
// explicit confirmation BEFORE the call, not a draft/apply step after.
// Behance/SoundCloud/Vimeo/Website all route through analyze-profile-url,
// which only *reads* and returns candidate items -- the insert for those
// happens in this file (below), so those four get the real draft/apply
// flow the other three can't safely have without a backend change.
const DIRECT_WRITE_PLATFORMS: Platform[] = ['imdb', 'youtube', 'spotify'];

interface PlatformResult {
  key: Platform;
  label: string;
  url: string;
  status: 'pending' | 'syncing' | 'done' | 'error' | 'skipped';
  count?: number;
  error?: string;
}

interface DraftCredit {
  id: string;
  platform: Platform;
  project_name: string;
  role: string;
  url: string | null;
  thumbnail_url: string | null;
  primary_media_url: string | null;
  media_type: string;
}

/**
 * One-click "Re-scan all my links" — loops through every saved external profile URL
 * and triggers the matching scraper. Useful when the user adds links over time.
 *
 * Enrichment safety (see DIRECT_WRITE_PLATFORMS above): nothing from
 * Behance/SoundCloud/Vimeo/Website is written to `credits` until the user
 * explicitly reviews and applies it below -- it's held as draft state in
 * this component only, never persisted, and clears on dismiss or refresh.
 * IMDb/YouTube/Spotify still write immediately (their edge functions do
 * it server-side), gated behind one explicit confirmation step instead.
 */
export const RescanAllLinksCard = ({ profile, onRefresh }: RescanAllLinksCardProps) => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [confirmingDirectWrite, setConfirmingDirectWrite] = useState(false);
  const [drafts, setDrafts] = useState<DraftCredit[]>([]);
  const [applying, setApplying] = useState(false);

  const buildJobs = (): PlatformResult[] => [
    { key: 'imdb', label: 'IMDb', url: profile.imdb_url || '', status: profile.imdb_url ? 'pending' : 'skipped' },
    { key: 'youtube', label: 'YouTube', url: profile.youtube_url || '', status: profile.youtube_url ? 'pending' : 'skipped' },
    { key: 'spotify', label: 'Spotify', url: profile.spotify_url || '', status: profile.spotify_url ? 'pending' : 'skipped' },
    { key: 'behance', label: 'Behance', url: profile.behance_url || '', status: profile.behance_url ? 'pending' : 'skipped' },
    { key: 'soundcloud', label: 'SoundCloud', url: profile.soundcloud_url || '', status: profile.soundcloud_url ? 'pending' : 'skipped' },
    { key: 'vimeo', label: 'Vimeo', url: profile.vimeo_url || '', status: profile.vimeo_url ? 'pending' : 'skipped' },
    { key: 'website', label: 'Website', url: profile.website || '', status: profile.website ? 'pending' : 'skipped' },
  ];

  const runOne = async (job: PlatformResult): Promise<{ job: PlatformResult; draftItems: DraftCredit[] }> => {
    if (job.status === 'skipped') return { job, draftItems: [] };
    try {
      let fnName: string;
      let body: Record<string, any>;
      if (job.key === 'imdb') {
        fnName = 'fetch-imdb-credits';
        body = { imdbUrl: job.url };
      } else if (job.key === 'youtube') {
        fnName = 'fetch-youtube-credits';
        body = { channelUrl: job.url, role: 'Cinematographer & Steadicam Operator' };
      } else if (job.key === 'spotify') {
        fnName = 'fetch-spotify-credits';
        body = { spotifyUrl: job.url };
      } else {
        fnName = 'analyze-profile-url';
        body = { url: job.url };
      }
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;

      if (fnName === 'analyze-profile-url') {
        // Read-only call -- nothing written yet. Hold as drafts for the
        // user to review below instead of inserting immediately.
        const items = (data?.data?.portfolio_items ?? []) as any[];
        const role = data?.data?.role || profile.role || 'Creator';
        const draftItems: DraftCredit[] = items.slice(0, 30).map((p, i) => ({
          id: `${job.key}-${i}-${p.media_url || p.title || i}`,
          platform: job.key,
          project_name: String(p.title || 'Untitled').slice(0, 200),
          role,
          url: p.media_url || null,
          thumbnail_url: p.thumbnail_url || null,
          primary_media_url: p.thumbnail_url || p.media_url || null,
          media_type: p.media_type || (job.key === 'soundcloud' ? 'audio' : 'image'),
        }));
        return { job: { ...job, status: 'done', count: draftItems.length }, draftItems };
      }

      // IMDb/YouTube/Spotify already wrote to `credits` server-side by now
      // (see DIRECT_WRITE_PLATFORMS comment) -- nothing left to gate here.
      const count = (data?.imported ?? data?.credits?.length ?? 0) as number;
      return { job: { ...job, status: 'done', count }, draftItems: [] };
    } catch (e: any) {
      return { job: { ...job, status: 'error', error: e?.message || 'Unknown error' }, draftItems: [] };
    }
  };

  const runJobs = async (jobs: PlatformResult[]) => {
    setRunning(true);
    const newDrafts: DraftCredit[] = [];
    const finalResults: PlatformResult[] = [...jobs];
    // Sequential to avoid hammering Firecrawl rate limits
    for (const job of jobs) {
      if (job.status === 'skipped') continue;
      setResults(prev => prev.map(p => p.key === job.key ? { ...p, status: 'syncing' } : p));
      const { job: result, draftItems } = await runOne(job);
      newDrafts.push(...draftItems);
      const idx = finalResults.findIndex(p => p.key === job.key);
      if (idx !== -1) finalResults[idx] = result;
      setResults(prev => prev.map(p => p.key === job.key ? result : p));
    }
    setRunning(false);
    if (newDrafts.length > 0) setDrafts(prev => [...prev, ...newDrafts]);
    return { newDrafts, finalResults };
  };

  const handleRescanAll = async () => {
    const jobs = buildJobs();
    setResults(jobs);
    if (jobs.every(j => j.status === 'skipped')) {
      toast({
        title: 'No links to scan',
        description: 'Add IMDb, YouTube, Spotify, Behance or SoundCloud URLs in Edit Profile first.',
      });
      return;
    }

    const hasDirectWriteJob = jobs.some(j => j.status !== 'skipped' && DIRECT_WRITE_PLATFORMS.includes(j.key));
    if (hasDirectWriteJob && !confirmingDirectWrite) {
      // One explicit confirmation before anything that writes immediately
      // runs -- the closest safeguard available without changing those
      // edge functions themselves (see DIRECT_WRITE_PLATFORMS above).
      setConfirmingDirectWrite(true);
      setResults([]);
      return;
    }
    setConfirmingDirectWrite(false);

    const { newDrafts, finalResults } = await runJobs(jobs);
    const imported = finalResults
      .filter(r => DIRECT_WRITE_PLATFORMS.includes(r.key))
      .reduce((sum, r) => sum + (r.count || 0), 0);
    const failed = finalResults.filter(r => r.status === 'error').length;

    const parts: string[] = [];
    if (imported > 0) parts.push(`${imported} imported from IMDb/YouTube/Spotify`);
    if (newDrafts.length > 0) parts.push(`${newDrafts.length} suggestion${newDrafts.length === 1 ? '' : 's'} ready to review`);
    if (failed > 0) parts.push(`${failed} platform${failed > 1 ? 's' : ''} failed`);
    toast({
      title: 'Re-scan complete',
      description: parts.length > 0 ? parts.join(', ') + '.' : 'Nothing new found.',
    });
    if (imported > 0) onRefresh();
  };

  const dismissDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));
  const dismissAllDrafts = () => setDrafts([]);

  const applyDraft = async (draft: DraftCredit) => {
    if (!profile?.user_id) return;
    setApplying(true);
    try {
      const { error } = await supabase.from('credits').insert([{
        user_id: profile.user_id,
        project_name: draft.project_name,
        role: draft.role,
        url: draft.url,
        thumbnail_url: draft.thumbnail_url,
        primary_media_url: draft.primary_media_url,
        media_type: draft.media_type,
        platform: draft.platform,
        source: draft.platform,
        verification_status: 'auto_discovered',
      }]);
      if (error) throw error;
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      toast({ title: 'Added to your Passport', description: draft.project_name });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Couldn't apply that suggestion", description: e?.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const applyAllDrafts = async () => {
    if (!profile?.user_id || drafts.length === 0) return;
    setApplying(true);
    try {
      const rows = drafts.map(d => ({
        user_id: profile.user_id,
        project_name: d.project_name,
        role: d.role,
        url: d.url,
        thumbnail_url: d.thumbnail_url,
        primary_media_url: d.primary_media_url,
        media_type: d.media_type,
        platform: d.platform,
        source: d.platform,
        verification_status: 'auto_discovered',
      }));
      const { error } = await supabase.from('credits').insert(rows);
      if (error) throw error;
      toast({ title: `${rows.length} suggestion${rows.length === 1 ? '' : 's'} applied` });
      setDrafts([]);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Couldn't apply suggestions", description: e?.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const linkedCount = buildJobs().filter(j => j.status !== 'skipped').length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Re-scan All My Links
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pull fresh credits from every connected platform in one shot.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {linkedCount} link{linkedCount === 1 ? '' : 's'}
        </Badge>
      </div>

      {confirmingDirectWrite && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-foreground">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" aria-hidden />
            IMDb, YouTube and Spotify credits import directly into your Passport —
            there's no review step for those three. Behance, SoundCloud, Vimeo and
            Website results will still come back as suggestions you approve below.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={handleRescanAll}>
              Confirm and scan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDirectWrite(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{r.label}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {r.status === 'syncing' && <KretopiaSpinner className="h-3 w-3" />}
                {r.status === 'done' && <CheckCircle2 className="h-3 w-3 text-success" />}
                {r.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
                {r.status === 'syncing' && 'Syncing…'}
                {r.status === 'done' && (DIRECT_WRITE_PLATFORMS.includes(r.key)
                  ? `+${r.count ?? 0} imported`
                  : `${r.count ?? 0} suggestion${r.count === 1 ? '' : 's'}`)}
                {r.status === 'error' && (r.error?.slice(0, 24) || 'Failed')}
                {r.status === 'skipped' && 'Not linked'}
                {r.status === 'pending' && 'Queued'}
              </span>
            </div>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              {drafts.length} suggestion{drafts.length === 1 ? '' : 's'} to review
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={dismissAllDrafts} disabled={applying}>
                Dismiss all
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={applyAllDrafts} disabled={applying}>
                {applying ? <KretopiaSpinner className="h-3 w-3" /> : null}
                Apply all
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{d.project_name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.platform} · suggestion</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    aria-label={`Dismiss ${d.project_name}`}
                    onClick={() => dismissDraft(d.id)}
                    disabled={applying}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => applyDraft(d)}
                    disabled={applying}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!confirmingDirectWrite && (
        <CtaButton
          size="sm"
          className="w-full gap-1.5"
          disabled={running || linkedCount === 0}
          onClick={handleRescanAll}
        >
          {running
            ? <><KretopiaSpinner className="h-3.5 w-3.5" /> Scanning…</>
            : <><RefreshCw className="h-3.5 w-3.5" /> Re-scan all</>}
        </CtaButton>
      )}
    </Card>
  );
};
