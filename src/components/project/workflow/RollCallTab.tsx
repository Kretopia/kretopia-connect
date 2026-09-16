import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, UserX, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collaborator } from "@/hooks/useProjectData";

interface Props { projectId: string; collaborators: Collaborator[]; currentUserId: string; }
type Status = "invited" | "confirmed" | "arrived" | "no_show";

interface Entry {
  id: string; project_id: string; person_user_id: string | null; person_name: string;
  status: string; arrived_at: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  invited:   { label: "Invited",   color: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confirmed", color: "bg-primary/10 text-primary" },
  arrived:   { label: "On set",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  no_show:   { label: "No show",   color: "bg-destructive/15 text-destructive" },
};

export function RollCallTab({ projectId, collaborators, currentUserId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_roll_call").select("*")
        .eq("project_id", projectId);
      setEntries((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Auto-seed entries from collaborators if none exist
  useEffect(() => {
    if (loading || entries.length > 0 || collaborators.length === 0) return;
    void seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, collaborators]);

  const seed = async () => {
    const rows = collaborators.map((c) => ({
      project_id: projectId,
      created_by: currentUserId,
      person_user_id: c.id,
      person_name: c.full_name || "Unnamed",
      status: "invited",
    }));
    if (rows.length === 0) return;
    await supabase.from("project_roll_call").insert(rows);
    void load();
  };

  const setStatus = async (id: string, status: Status) => {
    const patch: any = { status };
    if (status === "arrived") patch.arrived_at = new Date().toISOString();
    await supabase.from("project_roll_call").update(patch).eq("id", id);
    void load();
  };

  const getAvatar = (e: Entry) => collaborators.find((c) => c.id === e.person_user_id)?.avatar_url;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const counts = {
    arrived: entries.filter((e) => e.status === "arrived").length,
    total: entries.length,
  };

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Roll Call</h2>
          <p className="text-sm text-muted-foreground">Mark people as confirmed, on set, or no-show.</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <UserCheck className="h-3.5 w-3.5" /> {counts.arrived}/{counts.total} on set
        </Badge>
      </div>

      {entries.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Invite collaborators to the workspace and they'll show up here for check-in.
        </CardContent></Card>
      )}

      {entries.map((e) => {
        const status = (e.status as Status) ?? "invited";
        return (
          <Card key={e.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={getAvatar(e) || undefined} />
                <AvatarFallback>{e.person_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{e.person_name || "Unknown"}</div>
                <Badge className={cn("text-[10px] mt-0.5 font-medium border-0", STATUS_META[status].color)} variant="secondary">
                  {STATUS_META[status].label}
                  {status === "arrived" && e.arrived_at && (
                    <span className="ml-1 opacity-70">· {new Date(e.arrived_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant={status === "confirmed" ? "default" : "outline"} className="h-8 w-8" onClick={() => setStatus(e.id, "confirmed")} title="Confirmed">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant={status === "arrived" ? "default" : "outline"} className="h-8 w-8" onClick={() => setStatus(e.id, "arrived")} title="On set">
                  <UserCheck className="h-4 w-4" />
                </Button>
                <Button size="icon" variant={status === "no_show" ? "default" : "outline"} className="h-8 w-8" onClick={() => setStatus(e.id, "no_show")} title="No show">
                  <UserX className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
