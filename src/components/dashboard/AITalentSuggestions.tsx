import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, UserCheck, UserPlus, Star, MapPin,
  Loader2, RefreshCw, Eye, MessageSquare, Zap, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TalentSuggestion {
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

export function AITalentSuggestions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<TalentSuggestion[]>([]);
  const [shortlisted, setShortlisted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [activeOpportunity, setActiveOpportunity] = useState<string>("all");
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Load active opportunities for filter
  useEffect(() => {
    if (!user) return;
    supabase
      .from('opportunities')
      .select('id, title')
      .eq('created_by', user.id)
      .eq('status', 'open')
      .then(({ data }) => setOpportunities(data || []));
  }, [user]);

  const generateSuggestions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-talent-match', {
        body: {
          opportunity_id: activeOpportunity !== 'all' ? activeOpportunity : undefined,
          limit: 8,
        }
      });

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        setHasGenerated(true);
        if (data.suggestions.length > 0) {
          toast({ title: `Found ${data.suggestions.length} top matches`, description: "Ranked by skills, role, and experience" });
        } else {
          toast({ title: "No matches yet", description: data.message || "More creators are joining every day!" });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Couldn't generate suggestions", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleShortlist = async (talent: TalentSuggestion) => {
    if (!user) return;
    try {
      await supabase.from('talent_shortlist').upsert({
        company_user_id: user.id,
        talent_user_id: talent.user_id,
        opportunity_id: activeOpportunity !== 'all' ? activeOpportunity : null,
        match_score: talent.match_score,
        match_reasons: talent.match_reasons,
        status: 'shortlisted',
      }, { onConflict: 'company_user_id,talent_user_id,opportunity_id' });

      setShortlisted(prev => ({ ...prev, [talent.user_id]: true }));
      toast({ title: `${talent.full_name} shortlisted!` });
    } catch {
      toast({ title: "Failed to shortlist", variant: "destructive" });
    }
  };

  const handleRequest = async (talent: TalentSuggestion) => {
    if (!user) return;
    try {
      // Send connection request as a hire request
      await supabase.from('connections').insert({
        user_id: user.id,
        connected_user_id: talent.user_id,
        status: 'pending',
        is_message_request: true,
      });

      // Update shortlist status
      await supabase.from('talent_shortlist').upsert({
        company_user_id: user.id,
        talent_user_id: talent.user_id,
        opportunity_id: activeOpportunity !== 'all' ? activeOpportunity : null,
        match_score: talent.match_score,
        match_reasons: talent.match_reasons,
        status: 'requested',
      }, { onConflict: 'company_user_id,talent_user_id,opportunity_id' });

      toast({
        title: `Request sent to ${talent.full_name}`,
        description: "They'll be notified you're interested in working together"
      });
    } catch {
      toast({ title: "Failed to send request", variant: "destructive" });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-primary";
    return "text-accent";
  };

  // Initial CTA state
  if (!hasGenerated && suggestions.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Smart Talent Finder</h3>
              <p className="text-sm text-muted-foreground">
                Instantly discover the best creators for your projects
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" /> AI analyzes skills, experience & role fit
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4 text-primary" /> Shortlist & request creators instantly
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-primary" /> No searching — top matches delivered to you
            </div>
          </div>

          {opportunities.length > 0 && (
            <Select value={activeOpportunity} onValueChange={setActiveOpportunity}>
              <SelectTrigger className="mb-3 bg-background">
                <SelectValue placeholder="Match for a specific job..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles — General talent</SelectItem>
                {opportunities.map(opp => (
                  <SelectItem key={opp.id} value={opp.id}>{opp.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={generateSuggestions} disabled={loading} className="w-full gap-2" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Finding top talent..." : "Find My Top Matches"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Talent Suggestions
          </CardTitle>
          <div className="flex items-center gap-2">
            {opportunities.length > 0 && (
              <Select value={activeOpportunity} onValueChange={setActiveOpportunity}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Filter by job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {opportunities.map(opp => (
                    <SelectItem key={opp.id} value={opp.id}>{opp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" onClick={generateSuggestions} disabled={loading} className="h-8 w-8" aria-label="Refresh talent suggestions">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((talent) => (
          <div key={talent.user_id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 cursor-pointer" onClick={() => navigate(`/profile/${talent.user_id}`)}>
                <AvatarImage src={talent.avatar_url} />
                <AvatarFallback>{talent.full_name?.[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/profile/${talent.user_id}`)}>
                    {talent.full_name}
                  </p>
                  <span className={`text-xs font-bold ${getScoreColor(talent.match_score)}`}>
                    {talent.match_score}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{talent.role}</p>
                {talent.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {talent.location}
                  </p>
                )}

                {/* AI Headline */}
                <p className="text-xs text-primary/80 mt-1 italic">"{talent.headline}"</p>

                {/* Match reasons */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {talent.match_reasons.slice(0, 2).map((reason, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {reason}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/profile/${talent.user_id}`)}>
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  {shortlisted[talent.user_id] ? (
                    <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                      onClick={() => handleRequest(talent)}>
                      <MessageSquare className="h-3 w-3" /> Request
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="h-7 text-xs gap-1"
                      onClick={() => handleShortlist(talent)}>
                      <UserPlus className="h-3 w-3" /> Shortlist
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {suggestions.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={generateSuggestions} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Find more matches
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
