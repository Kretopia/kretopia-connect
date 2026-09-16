import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, CheckCircle2, Clock, Mic, MoreVertical, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moodLabel } from "./moodGradient";
import type { StudioFolder } from "./StudioFoldersBar";
import { MoveToFolderSheet } from "./MoveToFolderSheet";
import {
  moodAccent,
  monogram,
  type StudioProject,
  STATUS_PILL,
  PAY_DOT,
  PAY_LABEL,
} from "./studioCardHelpers";

export type { StudioProject };

interface StudioCardsGridProps {
  projects: StudioProject[];
  invoicesByProject?: Record<string, "paid" | "invoiced" | "unsent">;
  /** Per-project role check (can_see_milestone_money): owner/creative/
   * collaborator see the pay dot, client/guest don't. Missing entries are
   * treated as not-visible (fail closed), same convention as
   * StudioProjectsDashboard's identical prop. */
  moneyVisibleByProject?: Record<string, boolean>;
  onNewProject: () => void;
  folders?: StudioFolder[];
  onMoveToFolder?: (projectId: string, folderId: string | null) => void;
  /** Hide the hero feature card (useful inside a folder view). */
  hideHero?: boolean;
}

export const StudioCardsGrid = ({
  projects,
  invoicesByProject = {},
  moneyVisibleByProject,
  onNewProject,
  folders = [],
  onMoveToFolder,
  hideHero = false,
}: StudioCardsGridProps) => {
  const moneyVisible = (id: string): boolean => moneyVisibleByProject?.[id] ?? false;
  const navigate = useNavigate();
  const [moveTarget, setMoveTarget] = useState<StudioProject | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const hero = useMemo(
    () => (hideHero ? null : projects.find((p) => p.status === "active") ?? projects[0]),
    [projects, hideHero],
  );
  const rest = useMemo(
    () => (hero ? projects.filter((p) => p.id !== hero.id) : projects),
    [projects, hero],
  );

  const beginLongPress = (project: StudioProject) => {
    if (!onMoveToFolder) return;
    longPressFired.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { (navigator as any).vibrate?.(15); } catch { /* noop */ }
      }
      setMoveTarget(project);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-[10px] font-bold tracking-[0.22em] text-primary uppercase mb-4">
          Studios
        </p>
        <div
          className="mx-auto h-20 w-20 rounded-2xl flex items-center justify-center mb-5 border border-border"
          style={{ background: "hsl(var(--card))" }}
        >
          <span className="text-2xl font-black tracking-tight" style={{ color: moodAccent("creative") }}>
            ✦
          </span>
        </div>
        <h2 className="text-2xl font-black tracking-[-0.02em] mb-1">Open your first room</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
          Built for creatives. Tell us what you're making — voice or text. We'll set up the room.
        </p>
        <Button onClick={onNewProject} size="lg" className="gap-2 rounded-full">
          <Mic className="h-4 w-4" />
          What are you making?
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {hero && rest.length > 0 && (
          <FeatureCard
            project={hero}
            pay={moneyVisible(hero.id) ? invoicesByProject[hero.id] : undefined}
            onClick={() => navigate(`/desk/${hero.id}`)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(rest.length > 0 ? rest : projects).map((project) => {
            const status = STATUS_PILL[project.status ?? "active"] ?? STATUS_PILL.active;
            const accent = moodAccent(project.mood);
            const pay = moneyVisible(project.id) ? invoicesByProject[project.id] : undefined;
            const isDone = project.status === "completed";
            const currentFolder = folders.find((f) => f.id === project.studio_folder_id);

            return (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                draggable={!!onMoveToFolder}
                onDragStart={(e) => {
                  if (!onMoveToFolder) return;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-thrive-project", project.id);
                  e.dataTransfer.setData("text/plain", project.title);
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") beginLongPress(project);
                }}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerMove={(e) => {
                  // Cancel if finger drifts
                  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4) cancelLongPress();
                }}
                onClick={() => {
                  if (longPressFired.current) {
                    longPressFired.current = false;
                    return;
                  }
                  navigate(`/desk/${project.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/desk/${project.id}`);
                  }
                }}
                className={cn(
                  "group relative text-left overflow-hidden rounded-2xl cursor-pointer select-none",
                  "border border-border bg-card",
                  "transition-all hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5",
                  "focus:outline-none focus:ring-2 focus:ring-primary",
                )}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: accent }}
                  aria-hidden
                />

                <div className="pl-4 pr-3 py-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.14em]",
                        status.label === "Delivered" ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {status.label}
                    </span>
                    {pay && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mr-7"
                        title={PAY_LABEL[pay]}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[pay])} />
                        {PAY_LABEL[pay]}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-[17px] leading-[1.15] tracking-[-0.01em] line-clamp-2 min-h-[2.6em]">
                    {project.title}
                  </h3>

                  {(project.client_name || project.description) && (
                    <p className="text-[12px] text-muted-foreground line-clamp-1">
                      {project.client_name ?? project.description}
                    </p>
                  )}

                  <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.08em] truncate"
                      style={{ color: accent }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: accent }}
                      />
                      <span className="truncate text-foreground/70">
                        {currentFolder ? (
                          <span className="inline-flex items-center gap-1">
                            <Folder className="h-2.5 w-2.5" />
                            {currentFolder.name}
                          </span>
                        ) : (
                          project.pinned_stage || moodLabel(project.mood)
                        )}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : (
                        <Clock className="h-2.5 w-2.5" />
                      )}
                      {formatDistanceToNowStrict(new Date(project.updated_at))}
                    </span>
                  </div>
                </div>

                {/* Always-visible Move button — touch-friendly */}
                {onMoveToFolder && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoveTarget(project);
                    }}
                    aria-label="Move to folder"
                    className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full grid place-items-center bg-background/80 border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {onMoveToFolder && (
        <MoveToFolderSheet
          open={!!moveTarget}
          onOpenChange={(v) => !v && setMoveTarget(null)}
          folders={folders}
          currentFolderId={moveTarget?.studio_folder_id ?? null}
          projectTitle={moveTarget?.title}
          onMove={(folderId) => {
            if (moveTarget) onMoveToFolder(moveTarget.id, folderId);
          }}
        />
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Feature card — wider hero card for the most recent active project          */
/* -------------------------------------------------------------------------- */

interface FeatureCardProps {
  project: StudioProject;
  pay?: "paid" | "invoiced" | "unsent";
  onClick: () => void;
}

const FeatureCard = ({ project, pay, onClick }: FeatureCardProps) => {
  const status = STATUS_PILL[project.status ?? "active"] ?? STATUS_PILL.active;
  const accent = moodAccent(project.mood);
  const isDone = project.status === "completed";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left overflow-hidden rounded-3xl",
        "border border-border bg-card",
        "transition-all hover:border-foreground/30 hover:shadow-lg hover:-translate-y-0.5",
        "focus:outline-none focus:ring-2 focus:ring-primary",
      )}
    >
      <span
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ background: accent }}
        aria-hidden
      />

      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Now in the studio
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {status.label}
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div
            className="shrink-0 h-14 w-14 rounded-xl border border-border flex items-center justify-center font-black text-lg tracking-tight"
            style={{ color: accent }}
            aria-hidden
          >
            {monogram(project.title)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl sm:text-2xl font-black leading-[1.05] tracking-[-0.02em] line-clamp-2">
              {project.title}
            </h2>
            {(project.client_name || project.description) && (
              <p className="text-[12px] sm:text-[13px] text-muted-foreground line-clamp-1">
                {project.client_name ?? project.description}
              </p>
            )}
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
        </div>

        <div className="pt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.08em] text-foreground/70 truncate">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accent }}
            />
            {project.pinned_stage || moodLabel(project.mood)}
          </span>
          <span className="inline-flex items-center gap-3 shrink-0">
            {pay && (
              <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider">
                <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[pay])} />
                {PAY_LABEL[pay]}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {formatDistanceToNowStrict(new Date(project.updated_at))}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
};
