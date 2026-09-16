import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, ArrowRight, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface ProjectsTabProps {
  circleId: string;
  isMember: boolean;
}

export function CircleProjectsTab({ circleId, isMember }: ProjectsTabProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, status, budget, created_at")
        .eq("spark_room_id", circleId)
        .order("created_at", { ascending: false })
        .then(r => r, (err) => { console.error("Projects load failed:", err); return { data: [] as any[] }; });
      setProjects(data || []);
      setLoading(false);
    };
    load();
  }, [circleId]);

  if (loading) {
    return (
      <div className="px-4 py-12 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        eyebrow="Turn talk into work"
        title="No projects yet"
        description="Spin up a paid gig, collab, or creative project — your circle is your built-in team."
        action={isMember ? { label: "Start a project", icon: Plus, onClick: () => navigate(`/projects/new?circleId=${circleId}`) } : undefined}
      />
    );
  }

  return (
    <div className="px-4 pb-8 space-y-3">
      {isMember && (
        <Button variant="gradient" className="w-full" onClick={() => navigate(`/projects/new?circleId=${circleId}`)}>
          <Plus className="h-4 w-4 mr-1.5" /> Start a Project
        </Button>
      )}
      {projects.map(p => (
        <button
          key={p.id}
          onClick={() => navigate(`/project/${p.id}`)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <FolderKanban className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{p.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 capitalize">
                {p.status || "active"}
              </Badge>
              {p.budget && <span className="text-[10px] text-muted-foreground">{p.budget}</span>}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}
