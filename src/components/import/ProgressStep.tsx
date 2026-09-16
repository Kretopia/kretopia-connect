import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ImportJob } from "@/lib/studioImport";

interface Props {
  jobId: string;
  onDone: (job: ImportJob) => void;
  onRetry: () => void;
}

export const ProgressStep = ({ jobId, onDone, onRetry }: Props) => {
  const [job, setJob] = useState<ImportJob | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!alive || !data) return;
      setJob(data as unknown as ImportJob);
      if (data.status === "completed") onDone(data as unknown as ImportJob);
    };
    load().catch(() => undefined);

    const channel = supabase
      .channel(`import-job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "import_jobs", filter: `id=eq.${jobId}` }, (p) => {
        const row = p.new as unknown as ImportJob;
        setJob(row);
        if (row.status === "completed") onDone(row);
      })
      .subscribe();

    const poll = setInterval(() => { load().catch(() => undefined); }, 5000);
    return () => { alive = false; clearInterval(poll); supabase.removeChannel(channel); };
  }, [jobId, onDone]);

  const pct = job?.progress_percentage ?? 0;
  const failed = job?.failed_items ?? 0;
  const warnings: string[] = Array.isArray(job?.warnings) ? (job!.warnings as string[]) : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {job?.status === "completed"
            ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent-pay))]" />
            : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <p className="text-sm font-semibold">
            {job?.status === "completed" ? "All brought in" : job?.status === "failed" ? "Something went wrong" : "Bringing your work in…"}
          </p>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {job?.processed_items ?? 0} of {job?.total_items ?? 0} items · {job?.successful_items ?? 0} added
          {(job?.skipped_items ?? 0) > 0 ? ` · ${job?.skipped_items} already here` : ""}
          {failed > 0 ? ` · ${failed} need another go` : ""}
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          You can close this page — we'll keep going in the background.
        </p>
      </div>

      {(warnings.length > 0 || job?.error_summary) && (
        <div className="space-y-1.5 rounded-2xl border border-border bg-muted/40 p-4">
          {job?.error_summary && (
            <p className="flex gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {job.error_summary}
            </p>
          )}
          {warnings.map((w, i) => (
            <p key={i} className="flex gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {failed > 0 && job?.status !== "running" && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Retry {failed} failed item{failed === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  );
};
