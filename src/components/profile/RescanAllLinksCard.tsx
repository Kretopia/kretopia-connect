import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RescanAllLinksCardProps {
  profile: any;
  onRefresh: () => void;
}

type Platform = 'imdb' | 'youtube' | 'spotify' | 'behance' | 'soundcloud' | 'vimeo' | 'website';

interface PlatformResult {
  key: Platform;
  label: string;
  url: string;
  status: 'pending' | 'syncing' | 'done' | 'error' | 'skipped';
  count?: number;
  error?: string;
}

/**
 * One-click "Re-scan all my links" — loops through every saved external profile URL
 * and triggers the matching scraper. Useful when the user adds links over time.
 */
export const RescanAllLinksCard = ({ profile, onRefresh }: RescanAllLinksCardProps) => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PlatformResult[]>([]);

  const buildJobs = (): PlatformResult[] => [
    { key: 'imdb', label: 'IMDb', url: profile.imdb_url || '', status: profile.imdb_url ? 'pending' : 'skipped' },
    { key: 'youtube', label: 'YouTube', url: profile.youtube_url || '', status: profile.youtube_url ? 'pending' : 'skipped' },
    { key: 'spotify', label: 'Spotify', url: profile.spotify_url || '', status: profile.spotify_url ? 'pending' : 'skipped' },
    { key: 'behance', label: 'Behance', url: profile.behance_url || '', status: profile.behance_url ? 'pending' : 'skipped' },
    { key: 'soundcloud', label: 'SoundCloud', url: profile.soundcloud_url || '', status: profile.soundcloud_url ? 'pending' : 'skipped' },
    { key: 'vimeo', label: 'Vimeo', url: profile.vimeo_url || '', status: profile.vimeo_url ? 'pending' : 'skipped' },
    { key: 'website', label: 'Website', url: profile.website || '', status: profile.website ? 'pending' : 'skipped' },
  ];

  const runOne = async (job: PlatformResult): Promise<PlatformResult> => {
    if (job.status === 'skipped') return job;
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

      let count = 0;
      if (fnName === 'analyze-profile-url') {
        const items = (data?.data?.portfolio_items ?? []) as any[];
        if (items.length > 0 && profile?.user_id) {
          const role = data?.data?.role || profile.role || 'Creator';
          const rows = items.slice(0, 30).map((p) => ({
            user_id: profile.user_id,
            project_name: String(p.title || 'Untitled').slice(0, 200),
            role,
            url: p.media_url || null,
            thumbnail_url: p.thumbnail_url || null,
            primary_media_url: p.thumbnail_url || p.media_url || null,
            media_type: p.media_type || (job.key === 'soundcloud' ? 'audio' : 'image'),
            platform: job.key,
            source: job.key,
            verification_status: 'auto_discovered',
          }));
          const { error: insErr, count: inserted } = await supabase
            .from('credits')
            .insert(rows, { count: 'exact' });
          if (insErr) throw insErr;
          count = inserted ?? rows.length;
        }
      } else {
        count = (data?.imported ?? data?.credits?.length ?? 0) as number;
      }
      return { ...job, status: 'done', count };
    } catch (e: any) {
      return { ...job, status: 'error', error: e?.message || 'Unknown error' };
    }
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
    setRunning(true);
    // Sequential to avoid hammering Firecrawl rate limits
    const updated: PlatformResult[] = [];
    for (const job of jobs) {
      if (job.status === 'skipped') {
        updated.push(job);
        continue;
      }
      setResults(prev => prev.map(p => p.key === job.key ? { ...p, status: 'syncing' } : p));
      const result = await runOne(job);
      updated.push(result);
      setResults(prev => prev.map(p => p.key === job.key ? result : p));
    }
    setRunning(false);
    const totalImported = updated.reduce((sum, r) => sum + (r.count || 0), 0);
    const failed = updated.filter(r => r.status === 'error').length;
    toast({
      title: 'Re-scan complete',
      description: `${totalImported} new items imported${failed ? `, ${failed} platform${failed > 1 ? 's' : ''} failed` : ''}.`,
    });
    if (totalImported > 0) onRefresh();
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

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{r.label}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {r.status === 'syncing' && <Loader2 className="h-3 w-3 animate-spin" />}
                {r.status === 'done' && <CheckCircle2 className="h-3 w-3 text-success" />}
                {r.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
                {r.status === 'syncing' && 'Syncing…'}
                {r.status === 'done' && `+${r.count ?? 0}`}
                {r.status === 'error' && (r.error?.slice(0, 24) || 'Failed')}
                {r.status === 'skipped' && 'Not linked'}
                {r.status === 'pending' && 'Queued'}
              </span>
            </div>
          ))}
        </div>
      )}

      <Button
        size="sm"
        className="w-full gap-1.5"
        disabled={running || linkedCount === 0}
        onClick={handleRescanAll}
      >
        {running
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
          : <><RefreshCw className="h-3.5 w-3.5" /> Re-scan all</>}
      </Button>
    </Card>
  );
};
