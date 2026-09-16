import { useState } from "react";
import { Pencil, Loader2, Plus, ImageIcon, Mic, ListChecks, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MoodboardThumb } from "./MoodboardThumb";
import { BriefVoiceRecorder } from "./BriefVoiceRecorder";
import { FileCommentsSheet } from "./FileCommentsSheet";
import { MoodboardAIDialog } from "./MoodboardAIDialog";
import { MoodboardViewer } from "./MoodboardViewer";

interface BriefSectionProps {
  project: {
    id: string;
    description: string | null;
  };
  files: any[];
  isOwner: boolean;
  onUpdated: () => void;
  onAddReference: () => void;
  currentUserId?: string;
}

export const BriefSection = ({
  project,
  files,
  isOwner,
  onUpdated,
  onAddReference,
  currentUserId,
}: BriefSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const viewerId = currentUserId ?? user?.id ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  const [activeFile, setActiveFile] = useState<any | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const breakIntoTasks = async () => {
    if (!project.description?.trim() || !user) return;
    setBreakingDown(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "text", text: project.description, project_title: undefined },
      });
      if (error) throw error;
      const list: Array<{ title: string; description?: string | null }> = Array.isArray(
        (data as any)?.deliverables,
      )
        ? (data as any).deliverables.slice(0, 8)
        : [];
      if (!list.length) {
        toast({
          title: "Nothing to break down yet",
          description: "Add more detail to the brief and try again.",
        });
        return;
      }
      const rows = list.map((d) => ({
        project_id: project.id,
        title: d.title.slice(0, 200),
        description: d.description ?? null,
        status: "todo",
        created_by: user.id,
      }));
      const { error: insErr } = await supabase.from("project_tasks").insert(rows);
      if (insErr) throw insErr;
      toast({
        title: `${rows.length} task${rows.length === 1 ? "" : "s"} added`,
        description: "Find them in the Studio feed.",
      });
      onUpdated();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Couldn't break it down",
        description: err.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setBreakingDown(false);
    }
  };

  // Image files attached to the project become moodboard references
  const moodboard = files.filter((f) => {
    const url: string = f.file_url || f.url || "";
    const type: string = f.file_type || "";
    return /^image\//i.test(type) || /\.(jpe?g|png|gif|webp|avif)$/i.test(url);
  });

  const persist = async (text: string) => {
    const { error } = await supabase
      .from("projects")
      .update({ description: text.trim() || null })
      .eq("id", project.id);
    if (error) {
      toast({ title: "Couldn't save brief", description: error.message, variant: "destructive" });
      return false;
    }
    onUpdated();
    return true;
  };

  const save = async () => {
    setSaving(true);
    const ok = await persist(draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <section className="px-4 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1 w-6 rounded-full bg-[hsl(var(--energy))] shadow-[0_0_8px_hsl(var(--energy)/0.6)]" />
          <h2 className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
            The Brief
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {isOwner && !editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 rounded-full"
              onClick={() => setVoiceOpen(true)}
              aria-label="Record brief"
            >
              <Mic className="h-3.5 w-3.5" /> Voice
            </Button>
          )}
          {isOwner && !editing && project.description && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 rounded-full"
              onClick={() => {
                setDraft(project.description ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      </header>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's the vision? Tone, references, who it's for…"
            className="min-h-[140px] text-sm rounded-xl border-primary/30 focus-visible:ring-primary"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save brief"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(project.description ?? "");
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : project.description ? (
        <div className="space-y-4">
          {/* Editorial quote-style brief card */}
          <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/[0.03] p-5 sm:p-6">
            <span className="absolute -top-3 left-5 text-5xl font-black text-primary/30 leading-none select-none pointer-events-none">
              &ldquo;
            </span>
            <p className="text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">
              {project.description}
            </p>
            <div className="absolute bottom-3 right-4 h-1 w-8 rounded-full bg-gradient-to-r from-transparent to-primary/40" />
          </div>

          {isOwner && (
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-9 gap-1.5 text-xs rounded-full font-semibold",
                "bg-[hsl(var(--energy))] text-[hsl(var(--energy-foreground))]",
                "hover:bg-[hsl(var(--energy))]/90 shadow-[0_0_18px_hsl(var(--energy)/0.35)]",
              )}
              onClick={breakIntoTasks}
              disabled={breakingDown}
            >
              {breakingDown ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}
              {breakingDown ? "Breaking it down…" : "Break into tasks"}
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={!isOwner}
          onClick={() => isOwner && setVoiceOpen(true)}
          className={cn(
            "group w-full text-left rounded-2xl p-5 transition-all",
            "border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent",
            "hover:border-primary/60 hover:from-primary/10",
            "disabled:opacity-70 disabled:cursor-not-allowed",
          )}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-[var(--shadow-glow)] group-hover:scale-105 transition-transform">
              <Mic className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold leading-tight">
                {isOwner ? "Speak the vision" : "No brief yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {isOwner ? (
                  <>
                    Tap to record — or{" "}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditing(true);
                        }
                      }}
                      className="underline underline-offset-2 hover:text-foreground cursor-pointer"
                    >
                      type it out
                    </span>
                    .
                  </>
                ) : (
                  "The owner hasn't dropped the brief yet."
                )}
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Moodboard — polaroid strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold tracking-[0.22em] text-muted-foreground uppercase">
              Moodboard
            </p>
            {moodboard.length > 0 && (
              <span className="text-[10px] font-semibold text-muted-foreground/70">
                · {moodboard.length}
              </span>
            )}
          </div>
          {isOwner && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 rounded-full text-primary hover:bg-primary/10"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles className="h-3 w-3" /> Generate
              </Button>
              {moodboard.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 rounded-full"
                  onClick={onAddReference}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              )}
            </div>
          )}
        </div>

        {moodboard.length === 0 ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onAddReference}
              className={cn(
                "group flex flex-col items-center justify-center gap-2 w-full rounded-2xl",
                "border border-dashed border-border h-28",
                "bg-gradient-to-br from-muted/30 to-transparent",
                "hover:border-primary/50 hover:from-primary/5 transition-all",
              )}
            >
              <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                Drop images to set the mood
              </span>
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className={cn(
                  "group flex items-center justify-center gap-2 w-full rounded-2xl",
                  "border border-dashed border-primary/40 h-11",
                  "bg-gradient-to-br from-primary/5 to-transparent",
                  "hover:border-primary/70 hover:from-primary/10 transition-all",
                )}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  Generate one with AI
                </span>
              </button>
            )}
          </div>
        ) : (
          (() => {
            const VISIBLE = 6;
            const visible = moodboard.slice(0, VISIBLE);
            const hiddenCount = Math.max(0, moodboard.length - VISIBLE);
            return (
              <div className="grid grid-cols-2 gap-3">
                {visible.map((f, i) => {
                  const isLastTile = i === visible.length - 1 && hiddenCount > 0;
                  return (
                    <div
                      key={f.id ?? f.file_url}
                      className={cn(
                        "relative aspect-square rounded-xl overflow-hidden",
                        "bg-muted ring-1 ring-border shadow-[var(--shadow-sm)]",
                        "transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:ring-primary/40 group",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        aria-label={`Open ${f.file_name || "reference"}`}
                        className="block w-full h-full"
                      >
                        <MoodboardThumb
                          storedUrl={f.file_url}
                          alt={f.file_name || "Reference"}
                          className="w-full h-full object-cover"
                        />
                      </button>

                      {/* "+N more" overlay on the last visible tile */}
                      {isLastTile && (
                        <button
                          type="button"
                          onClick={() => setViewerIndex(VISIBLE - 1)}
                          className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center gap-0.5",
                            "bg-black/60 text-white backdrop-blur-[2px]",
                            "hover:bg-black/70 transition-colors",
                          )}
                          aria-label={`View all ${moodboard.length} references`}
                        >
                          <span className="text-2xl font-black leading-none">
                            +{hiddenCount}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                            View all
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFile(f);
                        }}
                        aria-label={`Notes for ${f.file_name || "reference"}`}
                        className={cn(
                          "absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full z-10",
                          "bg-black/55 text-white backdrop-blur-sm",
                          "flex items-center justify-center",
                          "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
                          "hover:bg-black/75",
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Inline + tile when there's room (no hidden overflow) */}
                {hiddenCount === 0 && isOwner && (
                  <button
                    type="button"
                    onClick={onAddReference}
                    aria-label="Add reference"
                    className={cn(
                      "aspect-square rounded-xl",
                      "border border-dashed border-primary/40 bg-primary/5",
                      "flex flex-col items-center justify-center gap-1",
                      "text-primary hover:bg-primary/10 hover:border-primary/70 transition-all",
                    )}
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      Add
                    </span>
                  </button>
                )}
              </div>
            );
          })()
        )}
      </div>

      <BriefVoiceRecorder
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        projectId={project.id}
        userId={user?.id}
        onSave={async (text) => {
          await persist(text);
        }}
        onTasksCreated={onUpdated}
      />

      <FileCommentsSheet
        open={!!activeFile}
        onOpenChange={(o) => !o && setActiveFile(null)}
        file={activeFile}
        currentUserId={viewerId}
      />

      <MoodboardAIDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        projectId={project.id}
        onGenerated={onUpdated}
      />

      <MoodboardViewer
        files={moodboard}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
        onOpenNotes={(f) => {
          setViewerIndex(null);
          setActiveFile(f);
        }}
      />
    </section>
  );
};
