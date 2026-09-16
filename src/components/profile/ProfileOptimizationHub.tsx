import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, TrendingUp, Eye, Users, Target, 
  CheckCircle2, AlertCircle, Zap, ArrowRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProfileCompletionStatus } from "@/lib/profileCompletion";

interface ProfileOptimizationHubProps {
  completion: ProfileCompletionStatus;
  viewCount?: number;
  matchRate?: number;
  profileViews?: number;
}

export const ProfileOptimizationHub = ({ 
  completion, 
  viewCount = 0,
  matchRate = 0,
  profileViews = 0 
}: ProfileOptimizationHubProps) => {
  const navigate = useNavigate();

  const qualityScore = Math.round(
    completion.percentage * 0.6 + 
    (matchRate > 0 ? 20 : 0) + 
    (profileViews > 10 ? 20 : profileViews * 2)
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Great";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  const quickWins = [
    {
      title: "Add 3+ Skills",
      description: "Profiles with skills get 3x more views",
      impact: "High",
      missing: completion.missingFields.includes("Skills (3+)"),
      action: () => navigate('/profile', { state: { section: 'skills' } })
    },
    {
      title: "Upload Portfolio Item",
      description: "Show your best work to attract opportunities",
      impact: "High",
      missing: completion.missingFields.includes("Portfolio Items"),
      action: () => navigate('/profile', { state: { section: 'portfolio' } })
    },
    {
      title: "Write Compelling Bio",
      description: "Tell your story in 50+ words",
      impact: "Medium",
      missing: completion.missingFields.includes("Bio"),
      action: () => navigate('/profile', { state: { section: 'bio' } })
    },
    {
      title: "Add Profile Picture",
      description: "Profiles with photos get 10x more engagement",
      impact: "Critical",
      missing: completion.missingFields.includes("Profile Picture"),
      action: () => navigate('/profile', { state: { section: 'avatar' } })
    },
  ];

  const activeQuickWins = quickWins.filter(win => win.missing);

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 via-accent/5 to-background border-primary/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Profile Optimization
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Maximize your visibility and opportunities
            </p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(qualityScore)}`}>
              {qualityScore}
            </div>
            <div className="text-xs text-muted-foreground">
              {getScoreLabel(qualityScore)}
            </div>
          </div>
        </div>

        <Tabs defaultValue="quickwins" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quickwins">Quick Wins</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="quickwins" className="space-y-4 mt-4">
            {activeQuickWins.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">All Quick Wins Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Your profile is optimized for maximum visibility
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Complete these for instant profile boost</span>
                </div>
                {activeQuickWins.map((win, index) => (
                  <Card 
                    key={index}
                    className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary"
                    onClick={win.action}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{win.title}</h4>
                          <Badge 
                            variant={win.impact === "Critical" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {win.impact} Impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{win.description}</p>
                      </div>
                      <Button size="sm" variant="ghost">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Profile Views</span>
                  </div>
                  <span className="text-2xl font-bold">{profileViews}</span>
                </div>
                <Progress value={(profileViews / 100) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Goal: 100 views this month
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Match Rate</span>
                  </div>
                  <span className="text-2xl font-bold">{matchRate}%</span>
                </div>
                <Progress value={matchRate} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {matchRate < 20 ? "Complete profile to improve" : "Great job!"}
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Completion</span>
                  </div>
                  <span className="text-2xl font-bold">{completion.percentage}%</span>
                </div>
                <Progress value={completion.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {completion.missingFields.length} fields remaining
                </p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex gap-3">
                  <TrendingUp className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Stand Out Strategy</h4>
                    <p className="text-sm text-muted-foreground">
                      Profiles with 5+ portfolio items receive 8x more opportunities. 
                      Add visual examples of your best work.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-accent/5 border-accent/20">
                <div className="flex gap-3">
                  <Users className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Connection Boost</h4>
                    <p className="text-sm text-muted-foreground">
                      Add social links to increase credibility. Profiles with verified 
                      social presence get 4x more connection requests.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-secondary/5">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Pro Tip</h4>
                    <p className="text-sm text-muted-foreground">
                      Update your profile at least once a month to stay visible 
                      in discovery feeds and search results.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {completion.percentage < 100 && (
          <Button 
            onClick={() => navigate('/profile')} 
            className="w-full"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Complete Profile Now (+50 XP)
          </Button>
        )}
      </div>
    </Card>
  );
};