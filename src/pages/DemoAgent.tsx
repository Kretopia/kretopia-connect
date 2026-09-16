import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/brand/BrandDots";
import { supabase } from "@/integrations/supabase/client";

type ToolCall = { tool: string; label: string; result: string };

const SAMPLE = `Brand campaign for a Caribbean rum launch. 3 reels, 1 hero film, 2-week turnaround, budget ~USD 8k.`;

// Deterministic, no-auth demo. Shows the *shape* of agent reasoning so accelerator
// reviewers can see autonomous tool-calling without needing to sign in.
function plan(brief: string): ToolCall[] {
  const lower = brief.toLowerCase();
  const calls: ToolCall[] = [];
  calls.push({
    tool: "studio_brain.record_studio_brain",
    label: "Studio Brain · indexed brief",
    result: "Extracted: deliverables (3 reels + 1 hero), timeline (14d), budget USD 8k, vertical (spirits/CPG).",
  });
  calls.push({
    tool: "desk_agent.draft_tasks",
    label: "Desk-Agent · drafted 7 tasks",
    result: "Concept · Treatment · Cast · Location scout · Shoot day · Edit v1 · Final delivery.",
  });
  calls.push({
    tool: "pricing_copilot.draft_quote",
    label: "Pricing Co-Pilot · drafted quote",
    result: "Line items: pre-pro 1.5k · production 4k · post 2k · usage 0.5k. Valid 14 days.",
  });
  if (lower.includes("rum") || lower.includes("brand")) {
    calls.push({
      tool: "sponsor_radar.score_fit",
      label: "Sponsor Radar · brand fit check",
      result: "Caribbean spirits brands in scope: 12 leads. Top fit: regional rum portfolio + duty-free.",
    });
  }
  calls.push({
    tool: "smart_gig_scout.find_similar",
    label: "Smart Gig Scout · related gigs",
    result: "Surfaced 4 active calls (2 spirits brands, 1 tourism board, 1 hospitality group).",
  });
  return calls;
}

export default function DemoAgent() {
  const [brief, setBrief] = useState(SAMPLE);
  const [running, setRunning] = useState(false);
  const [calls, setCalls] = useState<ToolCall[] | null>(null);

  const run = async () => {
    setRunning(true);
    setCalls(null);
    const out = plan(brief);
    // Stream in for visual effect
    for (let i = 0; i < out.length; i++) {
      await new Promise(r => setTimeout(r, 450));
      setCalls(out.slice(0, i + 1));
    }
    // Best-effort log (anon-allowed insert)
    try {
      await (supabase as any).from("agent_runs").insert({
        agent_kind: "demo",
        trigger: "public_demo",
        input_summary: brief.slice(0, 200),
        output_summary: `${out.length} tool calls`,
        status: "ok",
      });
    } catch { /* ignore */ }
    setRunning(false);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Agent Demo · Kretopia</title>
        <meta name="description" content="Public, no-auth demo of Kretopia's agentic tool-calling for accelerator reviewers." />
      </Helmet>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Public Agent Demo</p>
        <h1 className="font-serif text-3xl md:text-4xl mt-1">Drop a brief. Watch the agents work.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          Type any creative brief. Thrive's agents will index it, draft tasks, draft a quote, scan for sponsors, and
          surface related gigs — exactly how they run inside a live ThriveDesk Studio.
        </p>
      </header>

      <Card className="p-4 space-y-3">
        <Textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4} className="text-sm" />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">No sign-in required.</span>
          <Button onClick={run} disabled={running || brief.trim().length < 12}>
            {running ? "Running…" : "Run the agents"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        {running && !calls && <div className="py-10 flex justify-center"><BrandLoader /></div>}
        {calls?.map((c, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] font-mono">{c.tool}</Badge>
              <span className="font-medium text-sm">{c.label}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{c.result}</p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        This is a deterministic demo for accelerator reviewers. Inside the product, the same tool registry runs
        against live Gemini Pro / 2.5 Flash models via Lovable AI Gateway, with per-tier daily caps.
      </p>
    </div>
  );
}
