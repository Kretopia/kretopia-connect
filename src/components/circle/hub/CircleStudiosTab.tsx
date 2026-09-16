import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, FolderKanban, Plus, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  circleId: string;
  isMember: boolean;
}

type Project = {
  id: string;
  title: string;
  workspace_type: string | null;
  created_by: string;
  created_at: string;
  video_room_url: string | null;
};

export function CircleStudiosTab({ circleId, isMember }: Props) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [owners, setOwners] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, workspace_type, created_by, created_at, video_room_url")
        .eq("spark_room_id", circleId)
        .order("created_at", { ascending: false })
        .limit(30);
      const rows = (data ?? []) as Project[];
      setProjects(rows);
      const ownerIds = [...new Set(rows.map(r => r.created_by))];
      if (ownerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", ownerIds);
        const map: Record<string, any> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
        setOwners(map);
      }
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [circleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (projects.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          icon={FolderKanban}
          title="No Studios yet"
          description={isMember
            ? "Spin up a Studio to collaborate on a release, shoot, podcast or campaign with your Crew."
            : "Studios are creative workspaces shared with this Crew. Join to start one."}
          action={isMember ? { label: "New Studio", icon: Plus, onClick: () => navigate(`/desk?circle=${circleId}`) } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      {isMember && (
        <Button variant="outline" className="w-full" onClick={() => navigate(`/desk?circle=${circleId}`)}>
          <Plus className="h-4 w-4 mr-2" /> New Studio for this Crew
        </Button>
      )}
      {projects.map(p => (
        <button
          key={p.id}
          onClick={() => navigate(`/desk/${p.id}`)}
          className="w-full text-left rounded-xl border bg-card p-3 hover:bg-accent/5 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-scout/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-5 w-5 text-scout" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{p.title}</p>
                {p.video_room_url && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-1">
                    <Video className="h-2.5 w-2.5" /> Room
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {owners[p.created_by]?.full_name || "Owner"}
                {p.workspace_type && <> · {p.workspace_type.replace(/_/g, " ")}</>}
                {" · "}{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
