import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Link2, Network, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  bio: string | null;
  location: string | null;
  badge: string | null;
}

interface DegreeExplorerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDegree?: 1 | 2 | 3;
}

export function DegreeExplorerDrawer({ open, onOpenChange, initialDegree = 1 }: DegreeExplorerDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDegree, setSelectedDegree] = useState<1 | 2 | 3>(initialDegree);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const degreeConfig = {
    1: {
      label: "1st Degree",
      description: "Your direct connections",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/30"
    },
    2: {
      label: "2nd Degree",
      description: "Friends of your friends",
      icon: Link2,
      color: "text-accent-foreground",
      bgColor: "bg-accent/10",
      borderColor: "border-accent/30"
    },
    3: {
      label: "3rd Degree",
      description: "Extended network",
      icon: Network,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      borderColor: "border-muted-foreground/30"
    }
  };

  const fetchProfiles = async (degree: number, newOffset: number = 0) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_profiles_by_degree', {
        p_user_id: user.id,
        p_degree: degree,
        p_limit: LIMIT,
        p_offset: newOffset
      });

      if (error) {
        console.error('[DegreeExplorer] Error:', error);
        return;
      }

      const newProfiles = (data || []) as Profile[];
      
      if (newOffset === 0) {
        setProfiles(newProfiles);
      } else {
        setProfiles(prev => [...prev, ...newProfiles]);
      }
      
      setHasMore(newProfiles.length === LIMIT);
      setOffset(newOffset + newProfiles.length);
    } catch (err) {
      console.error('[DegreeExplorer] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && user?.id) {
      setOffset(0);
      setProfiles([]);
      fetchProfiles(selectedDegree, 0);
    }
  }, [open, selectedDegree, user?.id]);

  const handleDegreeChange = (degree: 1 | 2 | 3) => {
    setSelectedDegree(degree);
    setOffset(0);
    setProfiles([]);
  };

  const handleViewProfile = (userId: string) => {
    onOpenChange(false);
    navigate(`/profile/${userId}`);
  };

  const handleMessage = (userId: string) => {
    onOpenChange(false);
    navigate(`/messages?user=${userId}`);
  };

  const loadMore = () => {
    fetchProfiles(selectedDegree, offset);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left">Explore Your Network</SheetTitle>
        </SheetHeader>

        {/* Degree Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {([1, 2, 3] as const).map((degree) => {
            const config = degreeConfig[degree];
            const Icon = config.icon;
            const isSelected = selectedDegree === degree;
            
            return (
              <button
                key={degree}
                onClick={() => handleDegreeChange(degree)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all whitespace-nowrap",
                  isSelected 
                    ? `${config.bgColor} ${config.borderColor} ${config.color}` 
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {degreeConfig[selectedDegree].description}
        </p>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[calc(85vh-180px)]">
          {loading && profiles.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : profiles.length === 0 ? (
            <div className="text-center py-8">
              <div className={cn("mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3", degreeConfig[selectedDegree].bgColor)}>
                {(() => {
                  const Icon = degreeConfig[selectedDegree].icon;
                  return <Icon className={cn("h-6 w-6", degreeConfig[selectedDegree].color)} />;
                })()}
              </div>
              <p className="text-muted-foreground">
                No {degreeConfig[selectedDegree].label.toLowerCase()} connections yet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedDegree === 1 
                  ? "Connect with creators to grow your network"
                  : "Grow your direct connections to expand this circle"
                }
              </p>
            </div>
          ) : (
            <>
              {profiles.map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => handleViewProfile(profile.user_id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <Avatar className="h-12 w-12 border-2 border-background">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{profile.full_name}</p>
                        {profile.badge && profile.badge !== 'none' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {profile.badge}
                          </Badge>
                        )}
                      </div>
                      {profile.role && (
                        <p className="text-sm text-muted-foreground truncate">{profile.role}</p>
                      )}
                      {profile.location && (
                        <p className="text-xs text-muted-foreground truncate">{profile.location}</p>
                      )}
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {selectedDegree === 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMessage(profile.user_id)}
                        aria-label={`Message ${profile.full_name}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleViewProfile(profile.user_id)}
                      aria-label={`View ${profile.full_name}'s profile`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
