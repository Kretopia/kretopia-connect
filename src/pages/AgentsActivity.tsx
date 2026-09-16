import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/brand/BrandDots";
import { formatDistanceToNow } from "date-fns";

const sb = supabase as any;

type Row = {
  id: string;
  agent: string;
  trigger: string;
  outcome: string;
  at: string;
  accent: "passport" | "scout" | "match" | "pay";
};

async function safe<T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try { const r = await p; return (r?.data as T[]) ?? []; } catch { return []; }
}

async function loadActivity(): Promise<Row[]> {
  const [runs, props, scout, sponsors, intel, epk] = await Promise.all([
    safe<any>(sb.from("agent_runs").select("id, agent_kind, trigger, input_summary, output_summary, created_at").order("created_at", { ascending: false }).limit(30)),
    safe<any>(supabase.from("agent_proposals").select("id, kind, title, body, created_at").order("created_at", { ascending: false }).limit(15)),
    safe<any>(supabase.from("scouted_gig_actions").select("id, action, scouted_gig_id, outcome, created_at").order("created_at", { ascending: false }).limit(15)),
    safe<any>(supabase.from("sponsor_leads").select("id, brand_name, reason, fit_score, created_at").order("created_at", { ascending: false }).limit(15)),
    safe<any>(supabase.from("opportunity_intel_digests").select("id, kind, payload, created_at").order("created_at", { ascending: false }).limit(10)),
    safe<any>(supabase.from("epk_refresh_suggestions").select("id, kind, reason, created_at").order("created_at", { ascending: false }).limit(10)),
  ]);

  const rows: Row[] = [];
  for (const r of runs) rows.push({ id: r.id, agent: r.agent_kind, trigger: r.trigger, outcome: r.output_summary ?? r.input_summary ?? "—", at: r.created_at, accent: "match" });
  for (const p of props) rows.push({ id: p.id, agent: "Desk Agent", trigger: p.kind ?? "watch", outcome: p.title ?? (p.body ?? "").slice(0, 140), at: p.created_at, accent: "match" });
  for (const s of scout) rows.push({ id: s.id, agent: "Smart Gig Scout", trigger: s.action, outcome: `Gig ${String(s.scouted_gig_id ?? "").slice(0, 8)}${s.outcome ? ` — ${s.outcome}` : ""}`, at: s.created_at, accent: "scout" });
  for (const sp of sponsors) rows.push({ id: sp.id, agent: "Sponsor Radar", trigger: "discovered", outcome: `${sp.brand_name} — ${sp.reason ?? `fit ${sp.fit_score ?? ""}`}`.slice(0, 160), at: sp.created_at, accent: "scout" });
  for (const i of intel) rows.push({ id: i.id, agent: "Daily Intel Brief", trigger: i.kind ?? "cron", outcome: typeof i.payload === "object" ? JSON.stringify(i.payload).slice(0, 140) : String(i.payload ?? "").slice(0, 140), at: i.created_at, accent: "scout" });
  for (const e of epk) rows.push({ id: e.id, agent: "Passport Refresh", trigger: e.kind ?? "watch", outcome: (e.reason ?? "Suggested an update").slice(0, 160), at: e.created_at, accent: "passport" });

  return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 50);
}

export default function AgentsActivity() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { loadActivity().then(setRows).catch(() => setRows([])); }, []);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Helmet>
        <title>Always-On Agents · Kretopia</title>
        <meta name="description" content="Live log of autonomous actions Kretopia agents have taken on behalf of creators." />
      </Helmet>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Agent Activity</p>
        <h1 className="font-serif text-3xl md:text-4xl mt-1">Always-on agents, doing real work.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          Every row below is an autonomous action a Kretopia agent has taken — drafting proposals, finding gigs,
          identifying sponsors, refreshing Creative Passports. No human in the loop required.
        </p>
      </header>

      {!rows && <div className="py-16 flex justify-center"><BrandLoader /></div>}
      {rows && rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No agent activity yet. Check back shortly.</Card>
      )}

      <div className="space-y-2">
        {rows?.map(r => (
          <Card key={r.id} className="p-4 flex items-start gap-3">
            <div className={`mt-1 h-2 w-2 rounded-full bg-${r.accent}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{r.agent}</span>
                <Badge variant="secondary" className="text-[10px]">{r.trigger}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(r.at), { addSuffix: true })}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.outcome}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
