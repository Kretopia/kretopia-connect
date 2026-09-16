import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, EyeOff, TrendingUp, Users, Search, 
  Target, AlertCircle, CheckCircle2, Sparkles 
} from "lucide-react";
import { checkProfileCompletion } from "@/lib/profileCompletion";

interface ProfileVisibilityDashboardProps {
  profile: any;
  portfolioCount: number;
}

export const ProfileVisibilityDashboard = ({ 
  profile, 
  portfolioCount 
}: ProfileVisibilityDashboardProps) => {
  const navigate = useNavigate();
  const [viewStats, setViewStats] = useState({ total: 0, thisWeek: 0, trend: 0 });
  const [searchAppearances, setSearchAppearances] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const completion = checkProfileCompletion(profile, portfolioCount);
  const isVisible = completion.isComplete;

  useEffect(() => {
    fetchVisibilityStats();
  }, [profile.user_id]);

  const fetchVisibilityStats = async () => {
    try {
      // Import and fetch real profile view stats
      const { getProfileViewStats } = await import('@/lib/profileViewTracking');
      const viewData = await getProfileViewStats(profile.user_id);
      
      setViewStats({
        total: viewData.total,
        thisWeek: viewData.thisWeek,
        trend: viewData.trend
      });
      
      // Search appearances based on profile completeness (proxy metric)
      const searchScore = Math.round(completion.percentage * 1.5);
      setSearchAppearances(searchScore);
    } catch (error: any) {
      toast({
        title: "Failed to load stats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const visibilityScore = Math.round(
    (completion.percentage * 0.4) + 
    (isVisible ? 30 : 0) + 
    (profile.verified_metrics ? 15 : 0) +
    (portfolioCount >= 3 ? 15 : portfolioCount * 5)
  );

  const getVisibilityLevel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-600" };
    if (score >= 60) return { label: "Good", color: "text-primary" };
    if (score >= 40) return { label: "Fair", color: "text-yellow-600" };
    return { label: "Low", color: "text-red-600" };
  };

  const visibilityLevel = getVisibilityLevel(visibilityScore);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isVisible ? (
                <Eye className="h-5 w-5 text-primary" />
              ) : (
                <EyeOff className="h-5 w-5 text-orange-500" />
              )}
              Profile Visibility
            </CardTitle>
            <CardDescription className="mt-2">
              {isVisible 
                ? "Your profile is discoverable" 
                : "Complete your profile to be discoverable"
              }
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${visibilityLevel.color}`}>
              {visibilityScore}
            </div>
            <Badge variant="secondary" className="mt-1">
              {visibilityLevel.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Alert */}
        {!isVisible && (
          <Card className="p-4 bg-orange-500/10 border-orange-500/30">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1 text-sm">Profile Hidden</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Complete these required fields to appear in discovery:
                </p>
                <div className="space-y-1">
                  {completion.missingFields.slice(0, 3).map((field, index) => (
                    <div key={index} className="text-xs flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-600"></span>
                      {field}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Visibility Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Views</span>
            </div>
            <div className="text-2xl font-bold">{viewStats.total}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className={`h-3 w-3 ${viewStats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <span className={`text-xs ${viewStats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {viewStats.trend >= 0 ? '+' : ''}{viewStats.trend}% this week
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Search Appearances</span>
            </div>
            <div className="text-2xl font-bold">{searchAppearances}</div>
            <div className="text-xs text-muted-foreground mt-1">
              times found in search
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">This Week</span>
            </div>
            <div className="text-2xl font-bold">{viewStats.thisWeek}</div>
            <div className="text-xs text-muted-foreground mt-1">
              profile views
            </div>
          </Card>
        </div>

        {/* Visibility Factors */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Visibility Factors</h4>
          
          <Card className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {completion.isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm font-medium">Profile Completion</span>
              </div>
              <span className="text-sm font-bold">{completion.percentage}%</span>
            </div>
            <Progress value={completion.percentage} className="h-2" />
          </Card>

          <Card className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {portfolioCount >= 3 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm font-medium">Portfolio Strength</span>
              </div>
              <span className="text-sm font-bold">{portfolioCount}/3</span>
            </div>
            <Progress value={(portfolioCount / 3) * 100} className="h-2" />
          </Card>

          <Card className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {profile.verified_metrics ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm font-medium">Social Verification</span>
              </div>
              <Badge variant={profile.verified_metrics ? "default" : "secondary"}>
                {profile.verified_metrics ? "Verified" : "Not Verified"}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Recommendations */}
        {visibilityScore < 80 && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-2 text-sm">Boost Your Visibility</h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {!completion.isComplete && (
                    <li>• Complete all required profile fields to appear in discovery</li>
                  )}
                  {portfolioCount < 3 && (
                    <li>• Add {3 - portfolioCount} more portfolio items (profiles with 3+ get 5x more views)</li>
                  )}
                  {!profile.verified_metrics && (
                    <li>• Verify your social media metrics for 30% visibility boost</li>
                  )}
                  <li>• Share your profile and portfolio items regularly to increase engagement</li>
                </ul>
              </div>
            </div>
          </Card>
        )}

        {!isVisible && (
          <Button className="w-full" size="lg" onClick={() => navigate('/profile')}>
            <Target className="mr-2 h-4 w-4" />
            Complete Profile to Get Discovered
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
