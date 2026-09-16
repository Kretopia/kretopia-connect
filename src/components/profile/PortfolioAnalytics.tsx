import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, Eye, Heart, MessageCircle, Share2, 
  Star, BarChart3, Clock, Target 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PortfolioItem {
  id: string;
  title: string;
  view_count: number;
  created_at: string;
  media_type: string;
}

interface PortfolioAnalyticsProps {
  userId: string;
}

export const PortfolioAnalytics = ({ userId }: PortfolioAnalyticsProps) => {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch portfolio items
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('credits')
        .select('id, project_name, view_count, created_at, media_type')
        .eq('user_id', userId)
        .order('view_count', { ascending: false });

      if (portfolioError) throw portfolioError;

      // Fetch reactions per item
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('credit_reactions')
        .select('credit_id');

      if (reactionsError) throw reactionsError;

      // Count reactions per item
      const reactionCounts: Record<string, number> = {};
      reactionsData?.forEach(reaction => {
        reactionCounts[reaction.credit_id] = 
          (reactionCounts[reaction.credit_id] || 0) + 1;
      });

      setItems((portfolioData || []).map((c: any) => ({ id: c.id, title: c.project_name, view_count: c.view_count, created_at: c.created_at, media_type: c.media_type })));
      setReactions(reactionCounts);
    } catch (error: any) {
      toast({
        title: "Failed to load analytics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalViews = items.reduce((sum, item) => sum + (item.view_count || 0), 0);
  const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);
  const avgViewsPerItem = items.length > 0 ? Math.round(totalViews / items.length) : 0;
  const topPerformer = items[0];
  const engagementRate = totalViews > 0 ? Math.round((totalReactions / totalViews) * 100) : 0;

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '';
      case 'image': return '';
      case 'audio': return '';
      default: return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Analytics</CardTitle>
          <CardDescription>Add portfolio items to see insights</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Portfolio Analytics
        </CardTitle>
        <CardDescription>
          Understand what resonates with your audience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Top Items</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Views</span>
                </div>
                <div className="text-2xl font-bold">{totalViews}</div>
                <Progress value={100} className="h-1 mt-2" />
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Reactions</span>
                </div>
                <div className="text-2xl font-bold">{totalReactions}</div>
                <Progress value={engagementRate} className="h-1 mt-2" />
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Views</span>
                </div>
                <div className="text-2xl font-bold">{avgViewsPerItem}</div>
                <div className="text-xs text-muted-foreground mt-1">per item</div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Engagement</span>
                </div>
                <div className="text-2xl font-bold">{engagementRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">reaction rate</div>
              </Card>
            </div>

            {/* Top Performer */}
            {topPerformer && (
              <Card className="p-4 bg-primary/10 border-primary/30">
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Top Performer</h4>
                    <p className="text-sm mb-2">{topPerformer.title}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {topPerformer.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {reactions[topPerformer.id] || 0} reactions
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {getMediaTypeIcon(topPerformer.media_type)} {topPerformer.media_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Insights */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Insights & Recommendations</h4>
              
              {totalViews < 50 && (
                <Card className="p-3 bg-accent/10">
                  <div className="flex gap-2">
                    <TrendingUp className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <strong>Boost visibility:</strong> Share your portfolio items on the feed to increase views.
                    </div>
                  </div>
                </Card>
              )}

              {engagementRate < 10 && totalViews > 0 && (
                <Card className="p-3 bg-accent/10">
                  <div className="flex gap-2">
                    <MessageCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <strong>Increase engagement:</strong> Add more context to your portfolio items with detailed descriptions.
                    </div>
                  </div>
                </Card>
              )}

              {items.length < 5 && (
                <Card className="p-3 bg-primary/10">
                  <div className="flex gap-2">
                    <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <strong>Expand portfolio:</strong> Profiles with 5+ items get 3x more opportunities.
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-3 mt-4">
            {items.map((item, index) => (
              <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {getMediaTypeIcon(item.media_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {item.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {reactions[item.id] || 0} reactions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
