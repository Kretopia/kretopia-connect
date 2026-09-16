import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/PageTransition";
import { FreeTierGate } from "@/components/FreeTierGate";
import { useToast } from "@/hooks/use-toast";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoMark } from "@/components/brand/KretoMark";
import { TALENT_FINDER_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import {
  Sparkles, MapPin, Star,
  Eye, UserPlus, MessageSquare, Zap, Send,
  FileText, CheckCircle2, RefreshCw, Crown, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "hsl(var(--energy))";

interface TalentMatch {
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string;
  location: string;
  level: number;
  xp: number;
  professional_skills: any[];
  match_score: number;
  match_reasons: string[];
  headline: string;
}

export default function TalentFinder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { guard: guardAiMatch } = useFeatureGate("aiApplicantRankings");

  const initialQuery = searchParams.get("q") || "";
  const [brief, setBrief] = useState(initialQuery);
  const [matches, setMatches] = useState<TalentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [shortlisted, setShortlisted] = useState<Record<string, boolean>>({});

  // If we landed here from the Outcome Composer with a brief, surface it.
  useEffect(() => {
    if (initialQuery && initialQuery.length > 10) {
      toast({ title: "Brief loaded", description: "Hit Find talent when you're ready." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleFindTalent = async () => {
    if (!brief.trim() || brief.trim().length < 10) {
      toast({ title: "Tell us more", description: "Describe what you need in at least a sentence or two.", variant: "destructive" });
      return;
    }
    if (!guardAiMatch()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-talent-match", {
        body: { brief_text: brief, limit: 10 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMatches(data?.suggestions || []);
      if (data?.suggestions?.length > 0) {
        toast({ title: `${data.suggestions.length} matches found`, description: "Ranked by relevance to your brief" });
      } else {
        toast({ title: "No matches yet", description: "Try broadening your brief or check back as more creators join." });
      }
    } catch (err: any) {
      console.error("Talent match error:", err);
      toast({ title: "Matching failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleShortlist = async (talent: TalentMatch) => {
    if (!user) return;
    try {
      await supabase.from("talent_shortlist").upsert({
        company_user_id: user.id,
        talent_user_id: talent.user_id,
        match_score: talent.match_score,
        match_reasons: talent.match_reasons,
        status: "shortlisted",
      }, { onConflict: "company_user_id,talent_user_id,opportunity_id" });
      setShortlisted(prev => ({ ...prev, [talent.user_id]: true }));
      toast({ title: `${talent.full_name} shortlisted!` });
    } catch {
      toast({ title: "Failed to shortlist", variant: "destructive" });
    }
  };

  const handlePostAsGig = () => {
    // Navigate to opportunity creation with the brief pre-filled
    navigate("/post-opportunity", { state: { prefillBrief: brief } });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-[hsl(var(--energy))] bg-[hsl(var(--energy)/0.1)] border-[hsl(var(--energy)/0.25)]";
    if (score >= 70) return "text-[hsl(var(--signal-teal))] bg-[hsl(var(--signal-teal))]/10 border-[hsl(var(--signal-teal))]/25";
    return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Strong";
    return "Good";
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Smart Talent Finder | Kretopia</title>
        <meta name="description" content="Describe your project and instantly find the best creative talent — ranked by verified work." />
      </Helmet>

      <div className="min-h-screen bg-background pb-24">
        <FeaturePageHeader
          eyebrow="Hiring"
          title="Smart Talent Finder."
          accentTitle="Real matches, in real time."
          subtitle="Describe what you need — Kreto searches Kretopia's live creator network and ranks real, verified people against your brief."
          tutorial={{ featureKey: "talent-finder", label: "How Smart Talent Finder works", steps: TALENT_FINDER_TUTORIAL }}
        />

        {/* max-w-4xl, not the max-w-2xl this carried before — same class of
            fix as BrandWorkHome/CompanyProfileView (both moved to max-w-6xl
            earlier today): 672px read as a cramped column with ~384px of
            dead margin on each side at a 1440px viewport. This page is a
            single-column search/results list rather than a multi-column
            dashboard grid, so it doesn't need the full max-w-6xl those
            pages got — max-w-4xl gives real breathing room to the result
            cards (name, score, match reasons, actions) without leaving
            them looking sparse in an oversized row. */}
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
          <div className="flex justify-end">
            <Badge variant="secondary" className="gap-1 text-xs shrink-0">
              <Crown className="h-3 w-3" style={{ color: ACCENT }} /> Pro feature
            </Badge>
          </div>

        <FreeTierGate
          feature="aiApplicantRankings"
          featureLabel="Smart Talent Finder"
          description="Upgrade to Pro to unlock smart talent matching — describe your project and get instant ranked recommendations."
        >
          {/* Brief Input */}
          {!hasSearched || matches.length === 0 ? (
            <Card className="overflow-hidden rounded-2xl shadow-none border-border/60">
              <div
                className="p-5 space-y-4"
                style={{ background: "radial-gradient(120% 100% at 0% 0%, hsl(var(--energy) / 0.08), transparent 60%)" }}
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" style={{ color: ACCENT }} />
                    What do you need?
                  </label>
                  <Textarea
                    value={brief}
                    onChange={e => setBrief(e.target.value)}
                    placeholder={`e.g. "I need a video editor for a music video, budget $500, 2-week turnaround" or "Looking for a content creator to feature our villa — free 2-night stay in exchange for 1 Reel + 3 Stories"`}
                    rows={4}
                    maxLength={800}
                    disabled={loading}
                    className="bg-background resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{brief.length}/800</p>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                  <span>Include role, skills, budget, timeline, and location preferences for better matches</span>
                </div>

                <Button
                  onClick={handleFindTalent}
                  disabled={loading || brief.trim().length < 10}
                  className="w-full gap-2 text-white hover:opacity-90"
                  style={{ backgroundColor: ACCENT }}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Finding top matches...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Find My Top Matches
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ) : (
            /* Brief summary bar when results are showing */
            <Card className="p-3 rounded-2xl shadow-none border-border/60">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Your brief:</p>
                  <p className="text-sm line-clamp-2">{brief}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => { setHasSearched(false); setMatches([]); }}
                  >
                    <RefreshCw className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={handlePostAsGig}
                  >
                    <Send className="h-3 w-3" /> Post as Gig
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Loading State — Kreto's own identity mark, used everywhere else
              Kreto is actively working, instead of a generic spinner. */}
          {loading && (
            <div className="space-y-3 py-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <KretoMark size="md" state="active" />
                <div>
                  <p className="font-medium text-sm">Searching Kretopia's live creator network...</p>
                  <p className="text-xs text-muted-foreground">Scoring real profiles by skills, experience & fit against your brief</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && hasSearched && matches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full ai-ambient-breathe" style={{ backgroundColor: ACCENT }} />
                  {matches.length} match{matches.length !== 1 ? "es" : ""} found · live from Kretopia's creator network
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleFindTalent}
                  disabled={loading}
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              </div>

              {matches.map((talent, idx) => (
                <Card
                  key={talent.user_id}
                  className="p-3 rounded-2xl shadow-none border-border/60 hover:border-[hsl(var(--energy)/0.35)] transition-colors cursor-pointer"
                  onClick={() => navigate(`/profile/${talent.user_id}`)}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full border text-xs font-bold",
                        getScoreColor(talent.match_score)
                      )}>
                        {talent.match_score}%
                      </div>
                      <span className="text-[9px] text-muted-foreground">{getScoreLabel(talent.match_score)}</span>
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={talent.avatar_url} />
                      <AvatarFallback>{talent.full_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{talent.full_name}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
                      </div>
                      {talent.role && (
                        <p className="text-xs text-muted-foreground truncate">{talent.role}</p>
                      )}

                      {/* AI headline */}
                      <p className="text-xs mt-1 italic line-clamp-1" style={{ color: ACCENT, opacity: 0.85 }}>"{talent.headline}"</p>

                      {/* Match reasons */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {talent.match_reasons.slice(0, 2).map((reason, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {reason}
                          </Badge>
                        ))}
                      </div>

                      {talent.location && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                          <MapPin className="h-2.5 w-2.5" /> {talent.location}
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); navigate(`/profile/${talent.user_id}`); }}
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                        {shortlisted[talent.user_id] ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs gap-1"
                            onClick={e => { e.stopPropagation(); navigate(`/messages?to=${talent.user_id}`); }}
                          >
                            <MessageSquare className="h-3 w-3" /> Message
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs gap-1"
                            onClick={e => { e.stopPropagation(); handleShortlist(talent); }}
                          >
                            <UserPlus className="h-3 w-3" /> Shortlist
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Post as Gig CTA */}
              <Card className="p-4 rounded-2xl shadow-none border-dashed" style={{ borderColor: "hsl(var(--energy) / 0.3)", backgroundColor: "hsl(var(--energy) / 0.05)" }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: "hsl(var(--energy) / 0.1)" }}>
                    <FileText className="h-5 w-5" style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Want more applicants?</p>
                    <p className="text-xs text-muted-foreground">Turn your brief into a public gig post and let creators come to you.</p>
                  </div>
                  <Button size="sm" variant="default" className="gap-1 shrink-0" onClick={handlePostAsGig}>
                    <Send className="h-3 w-3" /> Post
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* No results */}
          {!loading && hasSearched && matches.length === 0 && (
            <div className="text-center py-10">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-medium text-sm mb-1">No matches found</p>
              <p className="text-xs text-muted-foreground mb-4">Try broadening your brief or adjusting the requirements.</p>
              <div className="flex flex-col gap-2 items-center">
                <Button variant="outline" size="sm" onClick={() => { setHasSearched(false); }}>
                  Edit Brief
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handlePostAsGig}>
                  <Send className="h-3 w-3" /> Post as a Gig instead
                </Button>
              </div>
            </div>
          )}
        </FreeTierGate>
        </div>
      </div>
    </PageTransition>
  );
}
