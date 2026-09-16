import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Briefcase, Award, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DemoProfile {
  full_name: string;
  role: string;
  bio: string;
  avatar_url: string;
  location: string;
  collab_intent: string;
  match_score: number;
  match_reasons: string[];
}

interface ProfilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName?: string;
  demoProfile?: DemoProfile | null;
}

export const ProfilePreviewDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  demoProfile
}: ProfilePreviewDialogProps) => {
  // Check if this is a demo profile (non-UUID)
  const isDemo = userId?.startsWith('demo-') || !!demoProfile;
  
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-preview', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, bio, avatar_url, location, professional_skills, passion_skills, instagram_followers, youtube_subscribers, tiktok_followers, spotify_listeners')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId && !isDemo,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });

  const { data: portfolioItems = [] } = useQuery({
    queryKey: ['portfolio-preview', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('credits')
        .select('id, title, media_url, thumbnail_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!userId && !isDemo,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });

  // Use demo profile data or real profile data
  const displayProfile = isDemo && demoProfile ? {
    full_name: demoProfile.full_name,
    role: demoProfile.role,
    bio: demoProfile.bio,
    avatar_url: demoProfile.avatar_url,
    location: demoProfile.location,
    professional_skills: ['Creative Direction', 'Content Strategy', 'Brand Development'],
    passion_skills: [] as string[],
    instagram_followers: 25000,
    youtube_subscribers: 5000,
    tiktok_followers: 15000,
    spotify_listeners: 0,
  } : profile;

  const skills = [
    ...(Array.isArray(displayProfile?.professional_skills) ? displayProfile.professional_skills : []),
    ...(Array.isArray(displayProfile?.passion_skills) ? displayProfile.passion_skills : [])
  ];
  
  // Demo portfolio items
  const demoPortfolioItems = isDemo ? [
    { id: 'demo-p1', title: 'Brand Campaign', thumbnail_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300' },
    { id: 'demo-p2', title: 'Product Shoot', thumbnail_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300' },
    { id: 'demo-p3', title: 'Lifestyle Content', thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300' },
    { id: 'demo-p4', title: 'Travel Series', thumbnail_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300' },
  ] : portfolioItems;
  
  const displayPortfolio = isDemo ? demoPortfolioItems : portfolioItems;
  const showLoading = !isDemo && isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isDemo ? 'Demo Profile Preview' : 'Profile Preview'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          {showLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading profile...</div>
            </div>
          ) : displayProfile ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={displayProfile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {displayProfile.full_name?.[0] || userName?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{displayProfile.full_name}</h3>
                  <p className="text-muted-foreground font-medium">{displayProfile.role}</p>
                  {displayProfile.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {displayProfile.location}
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {displayProfile.bio && (
                <div>
                  <h4 className="font-semibold mb-2">About</h4>
                  <p className="text-sm text-muted-foreground">{displayProfile.bio}</p>
                </div>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.slice(0, 12).map((skill: any, index: number) => {
                      const skillText = typeof skill === 'string' 
                        ? skill 
                        : skill.skill || skill.name || '';
                      
                      return skillText ? (
                        <Badge key={index} variant="secondary">
                          {skillText}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Portfolio */}
              {displayPortfolio.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Work
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {displayPortfolio.map((item: any) => (
                      <div
                        key={item.id}
                        className="aspect-square rounded-lg overflow-hidden bg-muted group relative"
                      >
                        {item.thumbnail_url || item.media_url ? (
                          <>
                            <img
                              src={item.thumbnail_url || item.media_url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <p className="text-white text-xs text-center px-2">{item.title}</p>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                                                      </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Stats */}
              {(displayProfile.instagram_followers || displayProfile.youtube_subscribers || displayProfile.tiktok_followers || displayProfile.spotify_listeners) && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Social Reach
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {displayProfile.instagram_followers && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Instagram</p>
                        <p className="text-lg font-bold">{(displayProfile.instagram_followers / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                    {displayProfile.youtube_subscribers && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">YouTube</p>
                        <p className="text-lg font-bold">{(displayProfile.youtube_subscribers / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                    {displayProfile.tiktok_followers && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">TikTok</p>
                        <p className="text-lg font-bold">{(displayProfile.tiktok_followers / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                    {displayProfile.spotify_listeners && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Spotify</p>
                        <p className="text-lg font-bold">{(displayProfile.spotify_listeners / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action to close and return to matching */}
              <div className="text-center text-sm text-muted-foreground">
                Close to swipe on this profile
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
