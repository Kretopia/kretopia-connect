import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, UserPlus, ArrowRight, Lightbulb, Zap, Users, Loader2, CheckCheck } from "lucide-react";

interface MatchedProfile {
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  match_score: number;
  reason: string;
  collab_idea: string;
  skill_match?: string[];
  match_type?: "complementary" | "similar";
}

interface MatchedProfilesStepProps {
  onComplete: (connectionCount: number) => void;
}

export const MatchedProfilesStep = ({ onComplete }: MatchedProfilesStepProps) => {
  const [matches, setMatches] = useState<MatchedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectingAll, setConnectingAll] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      // Add 15 second timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const fetchPromise = supabase.functions.invoke("get-onboarding-matches");

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (error) throw error;
      
      setMatches(data?.matches || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
      toast({
        title: "Could not load suggestions",
        description: "You can skip this step and explore creators on the Discover page",
      });
      // Set empty matches so user can skip
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (userId: string) => {
    setConnecting(userId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create connection request
      const { error } = await supabase
        .from("connections")
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status: "pending",
        });

      if (error) throw error;

      // Track connection request
      const { analytics } = await import("@/lib/analytics");
      analytics.connectionRequest(userId);

      setConnectedIds(prev => new Set([...prev, userId]));
      
      toast({
        title: "Connection Sent!",
        description: "You'll be notified when they accept",
      });
    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Failed to connect",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleConnectAll = async () => {
    setConnectingAll(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const unconnectedMatches = matches.filter(m => !connectedIds.has(m.user_id));
      
      // Connect to all unconnected matches
      for (const match of unconnectedMatches) {
        try {
          await supabase
            .from("connections")
            .insert({
              user_id: user.id,
              connected_user_id: match.user_id,
              status: "pending",
            });
          
          setConnectedIds(prev => new Set([...prev, match.user_id]));
        } catch (err) {
          console.error(`Failed to connect with ${match.full_name}:`, err);
        }
      }

      // Track analytics
      const { analytics } = await import("@/lib/analytics");
      for (const match of unconnectedMatches) {
        analytics.connectionRequest(match.user_id);
      }

      toast({
        title: `Connected with ${unconnectedMatches.length} creators!`,
        description: "You'll be notified when they accept",
      });
    } catch (error) {
      console.error("Error connecting all:", error);
      toast({
        title: "Failed to connect",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setConnectingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
              <Skeleton className="h-6 w-32 mx-auto mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary mb-4">
          <Sparkles className="h-4 w-4" />
          <span>Your Smart Matches</span>
        </div>
        <h2 className="text-3xl font-bold mb-3">
          Meet Your First Connections
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Based on your profile, here are creators we think you'll vibe with. 
          Connect now to start collaborating!
        </p>
      </div>

      {matches.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed">
          <div className="mb-4">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Building Your Network</h3>
            <p className="text-muted-foreground">
              We're finding the perfect matches for you, or you can skip ahead and explore on your own!
            </p>
          </div>
          <Button onClick={() => onComplete(0)} variant="gradient" size="lg">
            Skip to Discover <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      ) : (
        <>
          {/* Quick Connect All Banner */}
          {matches.length > 1 && connectedIds.size < matches.length && (
            <Card className="p-4 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border-primary/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <CheckCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Quick Connect</p>
                    <p className="text-sm text-muted-foreground">
                      Connect with all {matches.length} suggested creators in one click!
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleConnectAll}
                  disabled={connectingAll || connectedIds.size === matches.length}
                  className="gap-2 shrink-0"
                  size="lg"
                >
                  {connectingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-4 w-4" />
                      Connect All ({matches.length - connectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <Card key={match.user_id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20 mb-4 ring-2 ring-primary/20">
                    <AvatarImage src={match.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {match.full_name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg mb-1">{match.full_name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{match.role}</p>
                    <div className="flex items-center gap-2 justify-center">
                      <Badge variant="secondary" className="text-xs">
                        {match.match_score}% Match
                      </Badge>
                      {match.match_type && (
                        <Badge 
                          variant={match.match_type === "complementary" ? "default" : "outline"} 
                          className="text-xs"
                        >
                          {match.match_type === "complementary" ? (
                            <><Zap className="h-3 w-3 mr-1" /> Complementary</>
                          ) : (
                            <><Users className="h-3 w-3 mr-1" /> Similar</>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {match.bio}
                  </p>

                  {match.skill_match && match.skill_match.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3 justify-center">
                      {match.skill_match.slice(0, 3).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="bg-accent/30 rounded-lg p-3 mb-4 w-full">
                    <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Why Connect
                    </p>
                    <p className="text-xs text-muted-foreground">{match.reason}</p>
                  </div>

                  <div className="bg-secondary/20 rounded-lg p-3 mb-4 w-full">
                    <p className="text-xs font-medium text-secondary mb-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Collaboration Idea
                    </p>
                    <p className="text-xs text-muted-foreground">{match.collab_idea}</p>
                  </div>

                  <Button
                    onClick={() => handleConnect(match.user_id)}
                    disabled={connecting === match.user_id || connectedIds.has(match.user_id)}
                    variant={connectedIds.has(match.user_id) ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                  >
                    {connectedIds.has(match.user_id) ? (
                      "Request Sent ✓"
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center pt-6 space-y-3">
            <Button onClick={() => onComplete(connectedIds.size)} variant="gradient" size="lg" className="min-w-[280px]">
              {connectedIds.size > 0 
                ? `Continue with ${connectedIds.size} Connection${connectedIds.size > 1 ? 's' : ''}`
                : "Continue to Platform"
              } <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              You can always connect with more creators later
            </p>
          </div>
        </>
      )}
    </div>
  );
};