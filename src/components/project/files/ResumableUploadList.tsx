import { useEffect, useRef, useState } from "react";
import { startResumableUpload, type ResumableUploadHandle } from "@/lib/resumableUpload";
import { formatBytes } from "@/lib/fileSizeLimits";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Pause, Play, X, CheckCircle2, AlertCircle, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadJobStatus = "uploading" | "paused" | "done" | "error";

export interface UploadJob {
  id: string;
  file: File;
  bucket: string;
  path: string;
  /** Called after TUS finishes successfully — write your DB row here. */
  onComplete: (job: UploadJob) => Promise<void> | void;
}

interface Props {
  jobs: UploadJob[];
  onJobFinished: (id: string) => void;
  onJobRemoved: (id: string) => void;
}

interface JobState {
  uploaded: number;
  total: number;
  status: UploadJobStatus;
  error?: string;
  handle?: ResumableUploadHandle;
}

export function ResumableUploadList({ jobs, onJobFinished, onJobRemoved }: Props) {
  const [states, setStates] = useState<Record<string, JobState>>({});
  const startedRef = useRef<Set<string>>(new Set());

  // Kick off any new jobs.
  useEffect(() => {
    jobs.forEach((job) => {
      if (startedRef.current.has(job.id)) return;
      startedRef.current.add(job.id);

      setStates((s) => ({ ...s, [job.id]: { uploaded: 0, total: job.file.size, status: "uploading" } }));

      startResumableUpload({
        bucket: job.bucket,
        path: job.path,
        file: job.file,
        onProgress: (uploaded, total) => {
          setStates((s) => ({ ...s, [job.id]: { ...(s[job.id] || { status: "uploading" as UploadJobStatus }), uploaded, total } }));
        },
        onError: (err) => {
          setStates((s) => ({ ...s, [job.id]: { ...(s[job.id] || { uploaded: 0, total: job.file.size }), status: "error", error: err.message } }));
        },
        onSuccess: async () => {
          try {
            await job.onComplete(job);
            setStates((s) => ({ ...s, [job.id]: { ...(s[job.id] || { uploaded: job.file.size, total: job.file.size }), uploaded: job.file.size, status: "done" } }));
            onJobFinished(job.id);
          } catch (e: any) {
            setStates((s) => ({ ...s, [job.id]: { ...(s[job.id] || { uploaded: 0, total: job.file.size }), status: "error", error: e?.message || "Save failed" } }));
          }
        },
      })
        .then((handle) => {
          setStates((s) => ({ ...s, [job.id]: { ...(s[job.id] || { uploaded: 0, total: job.file.size, status: "uploading" }), handle } }));
        })
        .catch((err) => {
          setStates((s) => ({ ...s, [job.id]: { uploaded: 0, total: job.file.size, status: "error", error: err.message } }));
        });
    });
  }, [jobs, onJobFinished]);

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const st = states[job.id] || { uploaded: 0, total: job.file.size, status: "uploading" as UploadJobStatus };
        const pct = st.total ? Math.round((st.uploaded / st.total) * 100) : 0;
        return (
          <div key={job.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {st.status === "done" ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--energy))] shrink-0" />
                : st.status === "error" ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                : <FileUp className="h-4 w-4 text-primary shrink-0" />}
              <p className="text-sm font-medium truncate flex-1">{job.file.name}</p>
              <span className={cn("text-xs tabular-nums", st.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                {st.status === "done" ? "Done" : st.status === "error" ? "Failed" : `${pct}%`}
              </span>
            </div>
            {st.status !== "done" && st.status !== "error" && (
              <Progress value={pct} className="h-1.5" />
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {formatBytes(st.uploaded)} / {formatBytes(st.total)}
                {st.error && <span className="text-destructive ml-2">· {st.error}</span>}
              </p>
              <div className="flex items-center gap-1">
                {st.status === "uploading" && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { st.handle?.pause(); setStates((s) => ({ ...s, [job.id]: { ...st, status: "paused" } })); }}>
                    <Pause className="h-3 w-3" />
                  </Button>
                )}
                {st.status === "paused" && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { st.handle?.resume(); setStates((s) => ({ ...s, [job.id]: { ...st, status: "uploading" } })); }}>
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                {(st.status === "done" || st.status === "error") && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onJobRemoved(job.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {(st.status === "uploading" || st.status === "paused") && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => { st.handle?.abort(); onJobRemoved(job.id); }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
