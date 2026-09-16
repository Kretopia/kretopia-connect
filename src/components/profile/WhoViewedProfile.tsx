import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Crown, Sparkles, Lock, TrendingUp, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Viewer {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  viewed_at: string;
  source: string;
}

interface WhoViewedProfileProps {
  userId: string;
  isPro: boolean;
}

export function WhoViewedProfile({ userId, isPro }: WhoViewedProfileProps) {
  const navigate = useNavigate();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchViewers();
  }, [userId]);

  const fetchViewers = async () => {
    try {
      // Get total view count (available to all)
      const { count } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'profile_viewed')
        .eq('event_properties->>profile_user_id', userId);

      setTotalCount(count || 0);

      if (!isPro) {
        setLoading(false);
        return;
      }

      // Pro users: get actual viewer details (last 30 days, deduplicated)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: events } = await supabase
        .from('analytics_events')
        .select('user_id, event_properties, created_at')
        .eq('event_name', 'profile_viewed')
        .eq('event_properties->>profile_user_id', userId)
        .not('user_id', 'is', null)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!events?.length) {
        setLoading(false);
        return;
      }

      // Deduplicate by user_id, keep most recent
      const uniqueViewerMap = new Map<string, { viewed_at: string; source: string }>();
      for (const e of events) {
        if (e.user_id && !uniqueViewerMap.has(e.user_id)) {
          const props = e.event_properties as any;
          uniqueViewerMap.set(e.user_id, {
            viewed_at: e.created_at!,
            source: props?.source || 'public',
          });
        }
      }

      const viewerIds = Array.from(uniqueViewerMap.keys()).slice(0, 20);

      // Fetch viewer profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .in('user_id', viewerIds);

      const viewerList: Viewer[] = (profiles || [])
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name || 'Creator',
          avatar_url: p.avatar_url,
          role: p.role || 'Creative',
          viewed_at: uniqueViewerMap.get(p.user_id)!.viewed_at,
          source: uniqueViewerMap.get(p.user_id)!.source,
        }))
        .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());

      setViewers(viewerList);
    } catch (error) {
      console.error('Error fetching viewers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'match': return 'Circle';
      case 'search': return 'Search';
      case 'message': return 'Messages';
      case 'circle': return 'Circle';
      default: return 'Profile';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Who Viewed Your Profile
            {!isPro && (
              <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1 ml-1">
                <Lock className="h-3 w-3" /> PRO
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{totalCount}</span>
            <span className="text-muted-foreground text-xs">total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isPro ? (
          /* Free tier: blurred teaser */
          <div className="relative">
            <div className="pointer-events-none select-none filter blur-[5px] opacity-40 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-16 bg-muted rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                onClick={() => navigate("/subscription")}
                size="sm"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground gap-2"
              >
                <Sparkles className="h-4 w-4" />
                See Who's Viewing — Go Creator
              </Button>
            </div>
          </div>
        ) : viewers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No profile views in the last 30 days. Share your profile to get noticed!
          </p>
        ) : (
          <div className="space-y-2">
            {viewers.slice(0, 8).map((viewer) => (
              <button
                key={viewer.user_id}
                onClick={() => navigate(`/profile/${viewer.user_id}`)}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={viewer.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {viewer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{viewer.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{viewer.role}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px] mb-0.5">
                    {getSourceLabel(viewer.source)}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
            {viewers.length > 8 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{viewers.length - 8} more viewers this month
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
