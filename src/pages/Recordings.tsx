import { useEffect, useState } from "react";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadRecordings, type RecordingRow } from "@/lib/loadRecordings";
import { describeStoredRecording, type RecordingTone } from "@/lib/recordingState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WatchReplayButton } from "@/components/calls/WatchReplayButton";
import { CallRecapSheet } from "@/components/calls/CallRecapSheet";
import { formatDistanceToNow } from "date-fns";
import { Video, Sparkles, Clock, FileVideo, RefreshCw, AlertCircle } from "lucide-react";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { toast as sonnerToast } from "sonner";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoTip } from "@/components/agent/KretoTip";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { StudioSectionTabs } from "@/components/studio-reference/StudioSectionTabs";

const RECORDINGS_TUTORIAL: TutorialStep[] = [
  { icon: Video, title: "Every call gets recorded", body: "Tap Record during any Kretopia call. The replay lands here a few minutes after it ends: longer calls take a little longer." },
  { icon: Sparkles, title: "Kreto transcribes it for you", body: "Each recording is transcribed and summarized automatically — no manual note-taking." },
  { icon: FileVideo, title: "Pull the recap", body: "Open Recap on any call to get Kreto's extracted action items, not just a wall of transcript." },
];

type Row = RecordingRow;

/** What `sync-daily-recordings` answers: one entry per Daily recording it looked at. */
type SyncAnswer = {
  scanned?: number;
  results?: Array<{ recording_id?: string; transcript_id?: string; skipped?: string; error?: string }>;
};

const fmtDur = (s: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const KIND_LABEL: Record<string, string> = {
  project: "Studio call",
  direct: "1:1 call",
  circle: "Circle call",
  meeting: "Meeting",
  event: "Event",
  sound_stage: "Sound Stage",
  speed_session: "Speed session",
  curated_stage: "Showcase",
};

export default function Recordings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recapId, setRecapId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Which call kinds actually appear in the loaded rows, in KIND_LABEL's
  // declared order — drives the filter tabs below. A page with recordings
  // from 8 possible kinds otherwise has no way to narrow the list.
  const kindsPresent = Object.keys(KIND_LABEL).filter((k) => rows.some((r) => r.call_kind === k));

  const load = async (opts: { quiet?: boolean } = {}) => {
    if (!user?.id) return;
    if (!opts.quiet) setLoading(true);
    // No client-side kind/role filtering here on purpose -- RLS
    // (public.user_can_view_call_transcript) is the sole authorization
    // boundary and decides what this query actually returns. For
    // meeting/event/sound_stage/speed_session/curated_stage rows that means
    // HOST-ONLY: this page will only ever show a stage/meeting/event
    // recording to the user who hosted it, by design (see the migration
    // 20260915100000_document_call_transcript_host_only_visibility.sql for
    // the full rationale). project/direct/circle rows are additionally
    // visible to their participants.
    const result = await loadRecordings();
    if (result.error) {
      console.error("[Recordings]", result.error);
      // A failed refresh keeps the list already on screen instead of replacing it with an error.
      if (!opts.quiet) setLoadError(result.error);
    } else {
      setLoadError(null);
      setRows(result.rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load().catch((e) => {
      console.error("[Recordings]", e);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // While a recap is still being produced, look again every 15 s (for at most ~10 min) so it appears
  // without a manual refresh. A recap that has been pending for longer is shown as delayed, not polled.
  const waitingOnRecap = rows.some((r) => describeStoredRecording(r).inProgress);
  useEffect(() => {
    if (!waitingOnRecap) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks > 40) return clearInterval(timer);
      void load({ quiet: true });
    }, 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingOnRecap, user?.id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-daily-recordings", {
        body: { limit: 50 },
      });
      if (error) throw error;
      const answer = data as SyncAnswer | null;
      const results = answer?.results ?? [];
      const added = results.filter((r) => r.transcript_id && !r.skipped).length;
      const failed = results.filter((r) => r.error).length;
      const processing = results.filter((r) => typeof r.skipped === "string" && r.skipped.startsWith("status=")).length;
      if (failed > 0) {
        sonnerToast.error(`${failed} recording${failed === 1 ? "" : "s"} could not be saved`, {
          description: "Try again in a moment. The ones that were saved are on this page.",
        });
      } else {
        sonnerToast.success(
          added > 0 ? `Pulled ${added} new recording${added === 1 ? "" : "s"}` : processing > 0 ? "Still processing" : "All caught up",
          {
            description:
              processing > 0
                ? `${processing} recording${processing === 1 ? " is" : "s are"} still being finalised by Daily. Longer calls take longer.`
                : `Scanned ${answer?.scanned ?? 0} recent recordings from Daily.`,
          },
        );
      }
      await load();
    } catch (e: any) {
      sonnerToast.error("Couldn't sync", { description: e?.message || "Try again in a moment." });
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="min-h-dvh bg-background pb-24">
      <Helmet>
        <title>Call Recordings · Kretopia</title>
        <meta name="description" content="Watch replays, read transcripts and pull action items from your Kretopia video calls." />
      </Helmet>

      <div className="relative">

        <FeaturePageHeader
          scene="music-studio"
          eyebrow="Call recordings"
          title="Recordings."
          accentTitle="Every call, revisited."
          subtitle="Replays, transcripts, and Kreto-extracted action items from every recorded call."
          tutorial={{ featureKey: "recordings", label: "How Recordings works", steps: RECORDINGS_TUTORIAL }}
        />
      </div>

      <StudioFeatureShell wrapped={{ name: "Recordings" }}>
        <KretoTip compact />

      <div className="flex items-center justify-end">
        
        <Button type="button" size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5 shrink-0">
          {syncing ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Recordings are finalised a few minutes after a call ends (longer calls take longer). Tap Sync now to pull the latest.
      </p>

      <div>
        {loading ? (
          <KretopiaLoader size="sm" label="Loading…" className="py-12" />
        ) : loadError && rows.length === 0 ? (
          <Card role="alert" className="p-8 text-center rounded-2xl shadow-none border-dashed border-destructive/40">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive/70 mb-3" aria-hidden />
            <p className="font-semibold text-sm">Couldn't load your recordings</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              This is a loading problem, not an empty list. Your recordings are not affected.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => void load()}>
              Try again
            </Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center rounded-2xl shadow-none border-dashed border-border/60">
            <FileVideo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-sm">No recordings yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              During any Kretopia call, tap <b>Record</b>. When it ends, the replay, transcript
              and action items land here.
            </p>
          </Card>
        ) : kindsPresent.length <= 1 ? (
          // Only one call kind in the list (or none) — a filter would just
          // be a single useless tab, so skip straight to the flat list.
          <RecordingsList rows={rows} onRecap={setRecapId} />
        ) : (
          <StudioSectionTabs
            queryParam="kind"
            tabs={[
              { id: "all", label: "All", content: <RecordingsList rows={rows} onRecap={setRecapId} /> },
              ...kindsPresent.map((kind) => ({
                id: kind,
                label: KIND_LABEL[kind] ?? kind,
                content: <RecordingsList rows={rows.filter((r) => r.call_kind === kind)} onRecap={setRecapId} />,
              })),
            ]}
          />
        )}
      </div>
      </StudioFeatureShell>

      <CallRecapSheet
        open={!!recapId}
        onOpenChange={(o) => !o && setRecapId(null)}
        transcriptId={recapId}
      />
    </div>
  );
}

const TONE_CLASS: Record<RecordingTone, string> = {
  progress: "bg-secondary text-secondary-foreground",
  success: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  warning: "bg-amber-500/15 text-amber-600",
  danger: "bg-destructive/15 text-destructive",
};

function RecordingsList({ rows, onRecap }: { rows: Row[]; onRecap: (id: string) => void }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">No recordings in this category.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const dur = fmtDur(r.duration_seconds);
        const kindLabel = KIND_LABEL[r.call_kind] ?? r.call_kind;
        // The replay and the recap are separate: the row exists because Daily reported the recording
        // finished, so a transcript that is queued, skipped or failed never hides the replay.
        const state = describeStoredRecording(r);
        return (
          <Card key={r.id} className="p-4 flex items-start gap-3 rounded-2xl shadow-none border-border/60">
            <span className="h-10 w-10 rounded-xl bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0">
              <Video className="h-4 w-4" style={{ color: "hsl(var(--energy))" }} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-sm font-semibold">{kindLabel}</p>
                <Badge className={`h-4 px-1.5 text-[10px] border-0 ${TONE_CLASS[state.tone]}`}>
                  {state.transcriptLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                {dur && <span>· {dur}</span>}
              </p>
              {r.summary && state.canOpenRecap && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.summary}</p>
              )}
              {state.transcriptDetail && (
                <p className="text-xs text-muted-foreground mt-1.5">{state.transcriptDetail}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {state.canReplay ? (
                  <WatchReplayButton
                    transcriptId={r.id}
                    title={kindLabel}
                    subtitle={`${formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}${dur ? ` · ${dur}` : ""}`}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{state.recordingLabel}</span>
                )}
                {state.canOpenRecap && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onRecap(r.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Recap
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
