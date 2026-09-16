import { useState, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import {
  Search, Sparkles, Loader2, Users, ShieldCheck, CheckCircle2,
  Film, Music, Palette, Camera, MapPin, Star, ArrowRight, Zap,
  TrendingUp, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscoveryResult {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
  verified_credit_count: number;
  total_credit_count: number;
  top_roles: string[];
  top_projects: string[];
  match_score: number;
  match_reason: string;
  verification_tier: string | null;
  average_rating: number | null;
}

const QUICK_SEARCHES = [
  { label: "Music Video Director", icon: Film },
  { label: "Fashion Photographer", icon: Camera },
  { label: "Sound Engineer", icon: Music },
  { label: "Graphic Designer", icon: Palette },
];

const ICDBDiscovery = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-creators", {
        body: { query: q },
      });
      if (error) throw error;
      setResults(data?.results || []);
    } catch (err) {
      console.error("Discovery error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const getTierBadge = (tier: string | null) => {
    if (tier === "elite") return { label: "Elite", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
    if (tier === "industry") return { label: "Industry", className: "bg-primary/10 text-primary border-primary/30" };
    return null;
  };

  return (
    <>
      <Helmet>
        <title>Discover Creators — Kretopia Credits | Kretopia</title>
        <meta name="description" content="Find verified creative professionals matched by style consistency, verified work history, and smart compatibility scoring." />
      </Helmet>

      <div className="min-h-screen bg-background pb-24">
        {/* Hero */}
        <div className="bg-gradient-to-b from-primary/8 to-background border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Smart Discovery</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Find creators matched by <span className="text-foreground font-medium">verified work history</span>, not just keywords.
            </p>

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. 'Director who's worked on Carnival content'"
                  className="pl-9 h-11"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="h-11 gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Find
              </Button>
            </div>

            {/* Quick searches */}
            {!hasSearched && (
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                {QUICK_SEARCHES.map(qs => (
                  <Button
                    key={qs.label}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-[11px] h-8 rounded-full"
                    onClick={() => { setQuery(qs.label); handleSearch(qs.label); }}
                  >
                    <qs.icon className="h-3 w-3" /> {qs.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing verified credits...</p>
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-20">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No matches found</h3>
              <p className="text-sm text-muted-foreground">Try broadening your search criteria</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{results.length} creators matched</p>
                <Badge variant="outline" className="text-[10px] gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" /> By verified history
                </Badge>
              </div>

              {results.map(creator => {
                const tierBadge = getTierBadge(creator.verification_tier);
                return (
                  <Card
                    key={creator.user_id}
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-all hover:border-primary/20"
                    onClick={() => navigate(`/profile/${creator.user_id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={creator.avatar_url || ""} />
                            <AvatarFallback>{creator.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          {creator.match_score >= 80 && (
                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{creator.full_name}</h3>
                            {tierBadge && (
                              <Badge variant="outline" className={cn("text-[9px] h-4 gap-0.5", tierBadge.className)}>
                                <ShieldCheck className="h-2 w-2" /> {tierBadge.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{creator.role}</p>
                          {creator.location && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" /> {creator.location}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-lg font-bold",
                            creator.match_score >= 80 ? "text-green-600" : creator.match_score >= 50 ? "text-primary" : "text-muted-foreground"
                          )}>
                            {creator.match_score}%
                          </div>
                          <p className="text-[9px] text-muted-foreground uppercase">Match</p>
                        </div>
                      </div>

                      {/* Match reason */}
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 italic">
                        "{creator.match_reason}"
                      </p>

                      {/* Credits summary */}
                      <div className="flex items-center gap-3 mt-3 text-[11px]">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> {creator.verified_credit_count} verified
                        </span>
                        <span className="text-muted-foreground">{creator.total_credit_count} total credits</span>
                        {creator.average_rating && creator.average_rating > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <Star className="h-3 w-3 fill-current" /> {creator.average_rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Top projects */}
                      {creator.top_projects.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {creator.top_projects.slice(0, 3).map((proj, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] h-4">{proj}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Empty state before search */
            <div className="text-center py-16 space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Smart Creator Matching</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Describe what you need and Kreto will match you with creators based on their 
                  <span className="text-foreground font-medium"> verified work history</span> — not just buzzwords.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
                <div className="p-3 rounded-lg bg-muted/50">
                  <ShieldCheck className="h-4 w-4 text-primary mb-1" />
                  <p className="text-xs font-medium">Verified History</p>
                  <p className="text-[10px] text-muted-foreground">Matched by real, confirmed work</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <TrendingUp className="h-4 w-4 text-primary mb-1" />
                  <p className="text-xs font-medium">Style Consistency</p>
                  <p className="text-[10px] text-muted-foreground">AI analyzes creative patterns</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ICDBDiscovery;
