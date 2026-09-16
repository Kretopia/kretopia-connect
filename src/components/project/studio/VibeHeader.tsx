import { useState } from "react";
import { Pencil, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MoodPicker, type MoodId } from "./MoodPicker";
import { LivePresencePile } from "./LivePresencePile";
import { StudioTimer } from "./StudioTimer";
import { format } from "date-fns";


import { ProjectClientChip } from "@/components/clients/ProjectClientChip";

interface VibeHeaderProps {
  project: {
    id: string;
    title: string;
    cover_url?: string | null;
    mood?: string | null;
    client_name?: string | null;
    client_id?: string | null;
    deadline?: string | null;
    status?: string | null;
  };
  clientDisplayName?: string | null;
  isOwner: boolean;
  onUpdated: () => void;
  collaborators?: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
  onlineUserIds?: Set<string>;
  currentUserId?: string;
}

const STATUS_LABELS: Record<string, { label: string; tone: string; dot: string }> = {
  active: {
    label: "In Progress",
    tone: "bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] border-[hsl(var(--energy)/0.35)]",
    dot: "bg-[hsl(var(--energy))] shadow-[0_0_8px_hsl(var(--energy)/0.8)]",
  },
  planning: {
    label: "Planning",
    tone: "bg-muted/60 text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  wrapping: {
    label: "Wrapping Up",
    tone: "bg-primary/15 text-primary border-primary/30",
    dot: "bg-primary",
  },
  completed: {
    label: "Delivered",
    tone: "bg-secondary text-secondary-foreground border-border",
    dot: "bg-success",
  },
};

export const VibeHeader = ({
  project,
  clientDisplayName,
  isOwner,
  onUpdated,
  collaborators = [],
  onlineUserIds,
  currentUserId,
}: VibeHeaderProps) => {
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);

  const status = STATUS_LABELS[project.status ?? "active"] ?? STATUS_LABELS.active;
  
  const due = project.deadline ? new Date(project.deadline) : null;

  const updateProject = async (patch: Record<string, any>) => {
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return false;
    }
    onUpdated();
    return true;
  };

  const handleMood = (mood: MoodId) => {
    if (!isOwner) return;
    void updateProject({ mood });
  };

  const handleTitleSave = async () => {
    const next = titleDraft.trim();
    if (!next || next === project.title) {
      setEditingTitle(false);
      setTitleDraft(project.title);
      return;
    }
    const ok = await updateProject({ title: next });
    if (ok) setEditingTitle(false);
  };

  return (
    <section className="relative">
      {/* Body — clean, no cover. Brief carries the visual identity. */}
      <div className="px-4 pt-3 relative z-10 space-y-3">
        {/* Eyebrow + Status row */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
            Studio Room
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm",
              status.tone,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
        </div>

        {/* Live presence — face-pile of collaborators currently in the room */}
        {onlineUserIds && currentUserId && collaborators.length > 0 && (
          <LivePresencePile
            collaborators={collaborators}
            onlineUserIds={onlineUserIds}
            currentUserId={currentUserId}
          />
        )}

        {/* Title — sculptural, magazine-grade */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") {
                setEditingTitle(false);
                setTitleDraft(project.title);
              }
            }}
            className="w-full bg-transparent text-3xl sm:text-4xl font-black tracking-[-0.03em] outline-none border-b-2 border-primary pb-1"
          />
        ) : (
          <button
            type="button"
            disabled={!isOwner}
            onClick={() => isOwner && setEditingTitle(true)}
            className="group flex items-start gap-2 text-left w-full"
          >
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05] break-words">
              {project.title}
            </h1>
            {isOwner && (
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 mt-2.5 opacity-0 group-hover:opacity-100" />
            )}
          </button>
        )}

        {/* Mood vibe chip + meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-card/80 border border-border px-2 py-1 backdrop-blur-sm">
            <MoodPicker value={project.mood ?? null} onChange={handleMood} size="sm" />
          </div>
          {isOwner ? (
            <ProjectClientChip
              projectId={project.id}
              currentClientId={project.client_id}
              fallbackName={clientDisplayName ?? project.client_name}
            />
          ) : (clientDisplayName || project.client_name) ? (
            <span className="text-sm text-muted-foreground truncate">
              For{" "}
              <span className="text-foreground font-semibold">
                {clientDisplayName ?? project.client_name}
              </span>
            </span>
          ) : null}
          {due && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {format(due, "MMM d, yyyy")}
            </span>
          )}
          <div className="ml-auto">
            <StudioTimer
              projectId={project.id}
              userId={currentUserId}
              isOwner={isOwner}
            />
          </div>
        </div>
      </div>

      {/* Bottom hairline — subtle violet glow to anchor the hero */}
      <div className="mt-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </section>
  );
};
