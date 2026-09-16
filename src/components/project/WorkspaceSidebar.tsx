import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Briefcase, X, Sparkles, Search, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { VoiceFirstCreateModal } from "@/components/project/studio/VoiceFirstCreateModal";

interface SidebarProject {
  id: string;
  title: string;
  status: string | null;
  updated_at: string;
  deadline?: string | null;
}

interface WorkspaceSidebarProps {
  projects: SidebarProject[];
  activeProjectId?: string;
  onClose: () => void;
  /** Refreshes this sidebar's own project list after a new Project is created here. */
  onProjectCreated?: () => void;
}

type NavFilter = "all" | "active" | "completed";

const STATUS_DOT: Record<string, string> = {
  active: "bg-[hsl(var(--energy))]",
  planning: "bg-muted-foreground/50",
  wrapping: "bg-primary",
  completed: "bg-white",
  archived: "bg-muted-foreground/30",
};

/**
 * Compact Project Navigator — search, a lightweight status filter, and
 * dense rows (status dot, title, deadline only — no descriptions). "Needs
 * attention" / "awaiting approval" filters from the Studio overhaul spec
 * are intentionally NOT here: computing them needs the same invoice/
 * approval join StudioProjectsDashboard already owns on /desk, and
 * duplicating that heavier query into what's meant to be the lightweight
 * always-mounted sidebar isn't a good trade. An "unread activity"
 * indicator was also left out -- there's no last-viewed-at signal
 * anywhere in this data model to compute it from (see
 * STUDIO_ROOM_NAVIGATOR_REPORT.md).
 */
export function WorkspaceSidebar({ projects, activeProjectId, onClose, onProjectCreated }: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NavFilter>("all");

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === "active" && p.status !== "active") return false;
      if (filter === "completed" && p.status !== "completed") return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, query, filter]);

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Studios</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search + filters */}
        <div className="px-3 pt-3 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Projects"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            {([
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "completed", label: "Completed" },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Project List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {visibleProjects.map((project) => {
              const deadline = project.deadline ? new Date(project.deadline) : null;
              const overdue = deadline ? isPast(deadline) && project.status !== "completed" : false;
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    navigate(`/desk/${project.id}`);
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                    activeProjectId === project.id
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <div className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[project.status ?? ""] ?? "bg-muted-foreground/50")} />
                  <span className="truncate flex-1">{project.title}</span>
                  {deadline && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] shrink-0",
                        overdue ? "text-[hsl(var(--energy))] font-semibold" : "text-muted-foreground"
                      )}
                    >
                      <Calendar className="h-2.5 w-2.5" />
                      {format(deadline, "MMM d")}
                    </span>
                  )}
                </button>
              );
            })}

            {visibleProjects.length === 0 && projects.length > 0 && (
              <div className="text-center py-8 px-4">
                <p className="text-xs text-muted-foreground">No Projects match that search or filter.</p>
              </div>
            )}

            {projects.length === 0 && (
              <div className="text-center py-8 px-4">
                <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No projects yet</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Create a Project */}
        <div className="p-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Create a Project
          </Button>
        </div>
      </div>

      <VoiceFirstCreateModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onExpand={() => { setShowCreate(false); navigate("/desk/new-room"); }}
        onCreated={() => {
          setShowCreate(false);
          onProjectCreated?.();
        }}
      />
    </>
  );
}
