import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Copy, Check, Film, MessageSquare, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  project: { id: string; event_id?: string | null; created_by?: string | null; status?: string | null };
  currentUserId: string;
}

interface Recap {
  id: string;
  recap_caption: string | null;
  sponsor_recap_md: string | null;
  highlight_suggestions: any;
  thank_you_drafts: any;
  generated_at: string;
}

export const EventPostRecapSection = ({ project, currentUserId }: Props) => {
  const { toast } = useToast();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const eventId = project.event_id;
  const isHost = project.created_by === currentUserId;

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("event_recap_drafts")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()
      .catch(() => ({ data: null }));
    setRecap(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const generate = async () => {
    if (!eventId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-event-recap", {
        body: { event_id: eventId, project_id: project.id },
      });
      if (error) throw error;
      setRecap((data as any)?.recap ?? null);
      toast({ title: "Recap generated", description: "Review the drafts and share when ready." });
    } catch (e: any) {
      toast({ title: "Couldn't generate recap", description: e.message ?? "Try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!eventId || !isHost) return null;

  return (
    <section className="px-4 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">Phase 10</p>
          <h3 className="text-base font-black tracking-tight">Post-event recap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI drafts captions, sponsor reports, highlight ideas, and thank-yous.</p>
        </div>
        <Button onClick={generate} disabled={generating} size="sm" className="bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] font-bold gap-1.5">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {recap ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {recap && (
        <div className="space-y-3">
          {recap.recap_caption && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Social caption</p>
                <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => copy("cap", recap.recap_caption!)}>
                  {copied === "cap" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <Textarea
                value={recap.recap_caption}
                onChange={(e) => setRecap({ ...recap, recap_caption: e.target.value })}
                className="text-sm min-h-[80px]"
              />
            </Card>
          )}

          {recap.sponsor_recap_md && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><FileText className="h-3 w-3" /> Sponsor recap report</p>
                <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => copy("spons", recap.sponsor_recap_md!)}>
                  {copied === "spons" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <Textarea
                value={recap.sponsor_recap_md}
                onChange={(e) => setRecap({ ...recap, sponsor_recap_md: e.target.value })}
                className="text-xs min-h-[140px] font-mono"
              />
            </Card>
          )}

          {Array.isArray(recap.highlight_suggestions) && recap.highlight_suggestions.length > 0 && (
            <Card className="p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Film className="h-3 w-3" /> Highlight clip ideas</p>
              <ul className="space-y-1">
                {recap.highlight_suggestions.map((h: string, i: number) => (
                  <li key={i} className="text-xs text-foreground/90 flex gap-2">
                    <span className="text-[hsl(var(--energy))] font-bold">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {Array.isArray(recap.thank_you_drafts) && recap.thank_you_drafts.length > 0 && (
            <Card className="p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Thank-you drafts</p>
              <div className="space-y-2">
                {recap.thank_you_drafts.map((t: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/60 p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--energy))]">{t.audience ?? `Draft ${i + 1}`}</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(`ty-${i}`, t.message ?? "")}>
                        {copied === `ty-${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">{t.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground/70">Generated {new Date(recap.generated_at).toLocaleString()}</p>
        </div>
      )}

      {!loading && !recap && (
        <Card className="p-4 text-center text-xs text-muted-foreground">
          No recap yet. Hit "Generate" once your event wraps to draft everything in one shot.
        </Card>
      )}
    </section>
  );
};
