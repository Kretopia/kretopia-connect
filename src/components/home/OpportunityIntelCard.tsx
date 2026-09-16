import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Briefcase, Users, ArrowRight, Loader2, Radar } from "lucide-react";
import { toast } from "sonner";

interface DigestPayload {
  matches?: Array<{ user_id: string; display_name: string; primary_role?: string; avatar_url?: string; score: number }>;
  gigs?: Array<{ id: string; title: string; fit?: number; why?: string }>;
  summary?: string;
}

export const OpportunityIntelCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [digest, setDigest] = useState<{ id: string; payload: DigestPayload; generated_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchLatest();
  }, [user]);

  const fetchLatest = async () => {
    try {
      const { data } = await supabase
        .from("opportunity_intel_digests")
        .select("id, payload, generated_at")
        .eq("user_id", user!.id)
        .eq("kind", "daily_match")
        .is("dismissed_at", null)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setDigest(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateNow = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("daily-match-digest", { body: { user_id: user.id } });
      if (error) throw error;
      await fetchLatest();
      toast.success("Fresh intel ready");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const dismiss = async () => {
    if (!digest) return;
    await supabase.from("opportunity_intel_digests").update({ dismissed_at: new Date().toISOString() }).eq("id", digest.id);
    setDigest(null);
  };

  if (loading) return null;

  if (!digest) {
    return (
      <Card className={`p-4 bg-gradient-to-br from-primary/5 via-background to-energy/5 border-primary/20 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Your Intel Brief</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get a daily personalized snapshot of matches, gigs, and sponsor leads.</p>
            <Button size="sm" className="mt-3 h-8 text-xs" onClick={generateNow} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Generate brief
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const { matches = [], gigs = [], summary } = digest.payload || {};

  return (
    <Card className={`p-4 bg-gradient-to-br from-primary/5 via-background to-energy/5 border-primary/20 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-wider">Today's Intel</p>
        </div>
        <button onClick={dismiss} className="text-[10px] text-muted-foreground hover:text-foreground">dismiss</button>
      </div>

      {summary && <p className="text-sm font-semibold mb-3">{summary}</p>}

      {gigs.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Briefcase className="h-3.5 w-3.5 text-energy" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top gigs</p>
          </div>
          <div className="space-y-1.5">
            {gigs.slice(0, 3).map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/gigs/${g.id}`)}
                className="w-full text-left p-2 rounded-lg border border-border/50 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold line-clamp-1 flex-1">{g.title}</p>
                  {g.fit != null && <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">{g.fit}%</Badge>}
                </div>
                {g.why && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{g.why}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">People to know</p>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {matches.slice(0, 5).map((m) => (
              <button
                key={m.user_id}
                onClick={() => navigate(`/u/${m.user_id}`)}
                className="shrink-0 w-20 text-center"
              >
                <div className="h-12 w-12 mx-auto rounded-full bg-muted overflow-hidden border-2 border-primary/20">
                  {m.avatar_url ? <img src={m.avatar_url} alt={m.display_name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary/20 to-energy/20" />}
                </div>
                <p className="text-[10px] font-semibold mt-1 line-clamp-1">{m.display_name}</p>
                <p className="text-[9px] text-muted-foreground line-clamp-1">{m.primary_role}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => navigate("/intel")}>
        Open full brief <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </Card>
  );
};
