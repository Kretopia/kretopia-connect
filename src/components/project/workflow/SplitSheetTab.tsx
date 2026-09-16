import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Loader2, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Collaborator } from "@/hooks/useProjectData";

interface Props { projectId: string; collaborators: Collaborator[]; currentUserId: string; }
interface Split {
  id: string; project_id: string; contributor_user_id: string | null;
  contributor_name: string; contributor_role: string | null; percentage: number; notes: string | null;
}

export function SplitSheetTab({ projectId, collaborators, currentUserId }: Props) {
  const { toast } = useToast();
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_split_sheets").select("*")
        .eq("project_id", projectId);
      setSplits((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const add = async () => {
    const { error } = await supabase.from("project_split_sheets").insert({
      project_id: projectId, created_by: currentUserId,
      contributor_name: "New contributor", contributor_role: "Producer", percentage: 0,
    });
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else void load();
  };

  const update = async (id: string, patch: Partial<Split>) => {
    const { error } = await supabase.from("project_split_sheets").update(patch).eq("id", id);
    if (!error) void load();
  };

  const remove = async (id: string) => {
    await supabase.from("project_split_sheets").delete().eq("id", id);
    void load();
  };

  const total = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
  const balanced = Math.abs(total - 100) < 0.01;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Music className="h-5 w-5" /> Split Sheet</h2>
          <p className="text-sm text-muted-foreground">Document who contributed what & how royalties divide.</p>
        </div>
        <Button onClick={add} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Contributor</Button>
      </div>

      <Card className={cn("border-2", balanced ? "border-emerald-500/40" : total > 100 ? "border-destructive/50" : "border-amber-500/40")}>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Total split</span>
            <span className={cn("font-mono", balanced ? "text-emerald-600 dark:text-emerald-400" : total > 100 ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
              {total.toFixed(1)}%
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {splits.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No contributors yet. Add everyone who shaped this song.
        </CardContent></Card>
      )}

      {splits.map((s) => {
        const collab = collaborators.find((c) => c.id === s.contributor_user_id);
        return (
          <Card key={s.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={collab?.avatar_url || undefined} />
                <AvatarFallback>{s.contributor_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 grid grid-cols-12 gap-2">
                <Input className="col-span-12 sm:col-span-5" defaultValue={s.contributor_name} placeholder="Name" onBlur={(e) => update(s.id, { contributor_name: e.target.value })} />
                <Input className="col-span-7 sm:col-span-4" defaultValue={s.contributor_role ?? ""} placeholder="Role (Producer, Lyricist...)" onBlur={(e) => update(s.id, { contributor_role: e.target.value })} />
                <Input className="col-span-5 sm:col-span-3" type="number" min={0} max={100} step={0.5} defaultValue={s.percentage} onBlur={(e) => update(s.id, { percentage: parseFloat(e.target.value) || 0 })} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
