import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clapperboard, ListChecks, Loader2, Music2, Shirt, Sparkles, UserCheck, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductionPrepSectionProps {
  project: { id: string; workspace_type?: string | null };
  tasks: Array<{ title?: string | null }>;
  currentUserId: string;
  onOpenTool: (tab: string) => void;
  onUpdated: () => void;
}

const toolSets: Record<string, Array<{ tab: string; label: string; icon: any }>> = {
  photo_shoot: [
    { tab: "call_sheet", label: "Call Sheet", icon: Clapperboard },
    { tab: "roll_call", label: "Roll Call", icon: UserCheck },
    { tab: "revisions", label: "Revisions", icon: CheckCircle2 },
  ],
  video_shoot: [
    { tab: "call_sheet", label: "Call Sheet", icon: Clapperboard },
    { tab: "run_of_show", label: "Run of Show", icon: ListChecks },
    { tab: "roll_call", label: "Roll Call", icon: UserCheck },
  ],
  fashion_show: [
    { tab: "run_of_show", label: "Run of Show", icon: Shirt },
    { tab: "call_sheet", label: "Call Sheet", icon: Clapperboard },
    { tab: "roll_call", label: "Backstage", icon: UserCheck },
  ],
  event_production: [
    { tab: "run_of_show", label: "Run of Show", icon: CalendarClock },
    { tab: "call_sheet", label: "Call Sheet", icon: Clapperboard },
    { tab: "roll_call", label: "Roll Call", icon: UserCheck },
  ],
  music_project: [
    { tab: "split_sheet", label: "Split Sheet", icon: Music2 },
    { tab: "revisions", label: "Mix Notes", icon: CheckCircle2 },
  ],
};

const checklistSets: Record<string, string[]> = {
  photo_shoot: ["Lock shoot date and location", "Build shot list", "Confirm talent, wardrobe, hair and makeup", "Prep call sheet", "Back up selects and deliver proofs"],
  video_shoot: ["Lock treatment and scene list", "Confirm crew, cast, permits and releases", "Prep call sheet and run of show", "Check camera, sound and lighting kit", "Upload first cut for review"],
  fashion_show: ["Finalize model lineup and looks", "Map backstage changes", "Build runway run of show", "Confirm glam, stylist and dresser call times", "Collect final show assets"],
  event_production: ["Confirm venue, vendors and load-in", "Build run of show", "Assign stage/door/backstage leads", "Confirm guest/talent arrival times", "Capture recap assets and close vendor payments"],
  music_project: ["Confirm session date and contributors", "Track song splits", "Collect stems and references", "Send mix round for notes", "Approve master and release assets"],
  brand_collab: ["Confirm brief, usage rights and deadlines", "Draft content concepts", "Submit first cut for approval", "Track revision round", "Send final assets and invoice"],
  content_series: ["Outline episodes", "Create production calendar", "Batch record assets", "Edit and approve first post", "Schedule publishing"],
  edit_job: ["Collect raw assets and references", "Create first pass", "Send review link", "Apply revisions", "Export final deliverables"],
  commissioned_art: ["Confirm concept and dimensions", "Share sketch or mockup", "Approve direction", "Complete final artwork", "Package final handoff"],
  dj_live_gig: ["Confirm set time and tech rider", "Build setlist", "Check venue audio inputs", "Confirm payment and arrival", "Upload recap clips"],
  general: ["Confirm scope", "Create task list", "Share first draft", "Collect approval", "Wrap and assign credits"],
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function ProductionPrepSection({ project, tasks, currentUserId, onOpenTool, onUpdated }: ProductionPrepSectionProps) {
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const workspace = project.workspace_type || "general";
  const tools = toolSets[workspace] ?? [];
  const checklist = checklistSets[workspace] ?? checklistSets.general;
  const existing = useMemo(() => new Set(tasks.map((t) => normalize(t.title || ""))), [tasks]);
  const missing = checklist.filter((title) => !existing.has(normalize(title)));

  const seedChecklist = async () => {
    if (!missing.length) return;
    setSeeding(true);
    try {
      const { error } = await supabase.from("project_tasks").insert(
        missing.map((title, index) => ({
          project_id: project.id,
          title,
          status: "todo",
          priority: index === 0 ? "high" : "normal",
          labels: ["production"],
          created_by: currentUserId,
        })),
      );
      if (error) throw error;
      toast({ title: "Production checklist added", description: `${missing.length} task${missing.length === 1 ? "" : "s"} added without duplicates.` });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Couldn't add checklist", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <section className="px-4 py-5 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Prep</p>
          <h2 className="text-lg font-black leading-none tracking-tight">Production plan</h2>
        </div>
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
      </header>

      {tools.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tools.map(({ tab, label, icon: Icon }) => (
            <button key={tab} type="button" onClick={() => onOpenTool(tab)} className="rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50 hover:bg-accent/40 transition-colors">
              <Icon className="h-4 w-4 text-primary mb-2" />
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>
      )}

      <Button variant={missing.length ? "default" : "outline"} size="sm" className="w-full gap-2" onClick={seedChecklist} disabled={seeding || missing.length === 0}>
        {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {missing.length ? `Add ${missing.length} production tasks` : "Checklist already added"}
      </Button>
    </section>
  );
}
