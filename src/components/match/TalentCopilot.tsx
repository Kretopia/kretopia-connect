import { useState } from "react";
import { Loader2, Search, Sparkles, MapPin, ArrowRight, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AgentApprovalCard } from "@/components/agent/AgentApprovalCard";
import type { OrchAction } from "@/lib/agentOrchestrator";
import { useCurrentGeoCountry } from "@/hooks/useCurrentGeoCountry";

interface TalentMatch {
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string;
  location: string;
  professional_skills?: any[];
  match_score: number;
  match_reasons?: string[];
  headline?: string;
}

const TT_BRIEFS = [
  "Need a videographer in Trinidad for a 1-day brand shoot, budget under $500 USD.",
  "Looking for a soca vocalist for a hook on a track, fast turnaround, paid + credit.",
  "Photographer in Port of Spain for an EPK headshot session next weekend.",
];

const INTL_BRIEFS = [
  "Need a videographer for a 1-day brand shoot, budget under $500 USD.",
  "Looking for a vocalist for a hook on a track, fast turnaround, paid + credit.",
  "Photographer for an EPK headshot session next weekend.",
];

const TT_PLACEHOLDER = "e.g. Videographer in Trinidad for a 1-day brand shoot, budget under $500";
const INTL_PLACEHOLDER = "e.g. Videographer for a 1-day brand shoot, budget under $500";

/**
 * Talent Copilot — inline on Match → Find tab.
 * Flow: brief textarea → ai-talent-match → shortlist → "Draft outreach"
 *   → orchestrator inserts one Level-2 send_dm action per creator
 *   → AgentApprovalCard rendered per creator for tap-to-send.
 */
export const TalentCopilot = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brief, setBrief] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<TalentMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [proposedActions, setProposedActions] = useState<OrchAction[]>([]);
  const { geo } = useCurrentGeoCountry();
  const isTT = geo?.country === "Trinidad and Tobago" || geo?.country === "Trinidad" || geo?.city === "Port of Spain";
  const SAMPLE_BRIEFS = isTT ? TT_BRIEFS : INTL_BRIEFS;
  const placeholder = isTT ? TT_PLACEHOLDER : INTL_PLACEHOLDER;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = async (q?: string) => {
    const text = (q ?? brief).trim();
    if (text.length < 1) {
      toast({
        title: "Add a keyword or brief",
        description: "Even one word like 'model' or 'editor' works.",
        variant: "destructive",
      });
      return;
    }
    if (q !== undefined) setBrief(q);
    setSearching(true);
    setHasSearched(true);
    setProposedActions([]);
    setSelected(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("ai-talent-match", {
        body: { brief_text: text, limit: 8 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: TalentMatch[] = data?.suggestions ?? [];
      setMatches(list);
      // Pre-select top 3 by default
      setSelected(new Set(list.slice(0, 3).map((m) => m.user_id)));
      if (!list.length) {
        toast({
          title: "No matches yet",
          description: "Try broadening the brief or check back as more creators join.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Search failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleDraftOutreach = async () => {
    if (!user) return;
    if (selected.size === 0) {
      toast({ title: "Pick at least one creator", description: "Tap a card to add to your shortlist." });
      return;
    }
    setDrafting(true);
    try {
      const targets = matches.filter((m) => selected.has(m.user_id));
      const { data, error } = await supabase.functions.invoke("agent-orchestrator", {
        body: {
          mode: "draft_outreach_batch",
          brief: brief.trim(),
          creators: targets.map((t) => ({
            user_id: t.user_id,
            full_name: t.full_name,
            role: t.role,
            headline: t.headline,
            match_reasons: t.match_reasons,
          })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const actions: OrchAction[] = (data as any)?.actions ?? [];
      setProposedActions(actions);
      toast({
        title: `${actions.length} draft${actions.length === 1 ? "" : "s"} ready`,
        description: "Review each one and tap Approve to send.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't draft outreach",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDrafting(false);
    }
  };

  const removeApproval = (id: string) =>
    setProposedActions((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="space-y-4">
      {/* Brief input — warm, on-brand */}
      <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Talent Copilot</h3>
            <p className="text-xs text-muted-foreground">
              Describe who you need. We'll shortlist and draft the outreach.
            </p>
          </div>
        </div>

        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="resize-none mb-3 bg-background"
        />

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {SAMPLE_BRIEFS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSearch(s)}
              disabled={searching}
              className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
            >
              {s.split(",")[0]}
            </button>
          ))}
        </div>

        <Button
          onClick={() => handleSearch()}
          disabled={searching || brief.trim().length < 10}
          className="w-full"
        >
          {searching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Finding the right people…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Find matches
            </>
          )}
        </Button>
      </Card>

      {/* Loading state */}
      {searching && !matches.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 bg-muted rounded" />
                  <div className="h-2 w-1/2 bg-muted rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {hasSearched && !searching && matches.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No matches yet. Try broadening the brief — role, location, or skills.
          </p>
        </Card>
      )}

      {/* Shortlist */}
      {matches.length > 0 && !proposedActions.length && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selected.size}</span> selected of {matches.length}
            </p>
            <Button
              size="sm"
              onClick={handleDraftOutreach}
              disabled={drafting || selected.size === 0}
              className="gap-1.5"
            >
              {drafting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Draft outreach
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((m) => {
              const isSelected = selected.has(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggleSelect(m.user_id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={m.avatar_url} alt={m.full_name} />
                      <AvatarFallback>
                        {(m.full_name ?? "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{m.full_name}</p>
                        {typeof m.match_score === "number" && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0 border-primary/40 text-primary">
                            {Math.round(m.match_score)}%
                          </Badge>
                        )}
                      </div>
                      {m.role && (
                        <p className="text-xs text-muted-foreground truncate">{m.role}</p>
                      )}
                      {m.location && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{m.location}</span>
                        </p>
                      )}
                      {m.match_reasons && m.match_reasons.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                          {m.match_reasons.slice(0, 2).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Drafted outreach — per-creator approval cards */}
      {proposedActions.length > 0 && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-primary" />
                Ready to send
              </h3>
              <p className="text-xs text-muted-foreground">
                Review each draft. Approve to send, dismiss to skip.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setProposedActions([]);
                setSelected(new Set());
              }}
            >
              Start over
            </Button>
          </div>
          <div className="space-y-2">
            {proposedActions.map((a) => (
              <AgentApprovalCard
                key={a.id}
                action={a}
                onResolved={() => removeApproval(a.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
