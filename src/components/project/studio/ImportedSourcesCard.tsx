import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Row {
  id: string;
  provider: string;
  source_name: string | null;
  successful_items: number;
  completed_at: string | null;
  status: string;
}

const LABEL: Record<string, string> = {
  notion: "Notion",
  monday: "monday.com",
  slack_export: "Slack",
  csv: "CSV",
};

/** Quiet provenance strip — shows what was brought into this Studio from elsewhere. */
export const ImportedSourcesCard = ({ projectId }: { projectId: string }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("id, provider, source_name, successful_items, completed_at, status")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(4);
      setRows((data ?? []) as Row[]);
    })().catch(() => undefined);
  }, [projectId]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Download className="h-3.5 w-3.5" /> Brought in from elsewhere
        </p>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => navigate(`/studio/import?project=${projectId}`)}>
          Import more <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <Badge key={r.id} variant="secondary" className="rounded-full text-[10px] font-medium">
            {LABEL[r.provider] ?? r.provider}
            {r.source_name ? ` · ${r.source_name}` : ""} · {r.successful_items} items
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Imported history is kept read-only with a link back to where it came from.
      </p>
    </div>
  );
};
