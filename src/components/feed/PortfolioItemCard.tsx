import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Play, Eye, Sparkles, Flame } from "lucide-react";
import { MediaPlayerModal } from "@/components/profile/MediaPlayerModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getMediaThumbnail } from "@/lib/mediaUtils";
import DOMPurify from "dompurify";

interface PortfolioItemCardProps {
  item: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    embed_code: string | null;
    tags: string[];
    view_count: number;
    created_at: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  };
}

export const PortfolioItemCard = ({ item }: PortfolioItemCardProps) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [hasReacted, setHasReacted] = useState(false);
  const { toast } = useToast();

  const isPlayable = item.media_type === 'video' || item.media_type === 'audio';

  useEffect(() => {
    fetchReactions();
  }, [item.id]);

  const fetchReactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get reaction count
    const { count } = await supabase
      .from('credit_reactions')
      .select('*', { count: 'exact', head: true })
      .eq('credit_id', item.id);

    setReactionCount(count || 0);

    // Check if current user has reacted
    if (user) {
      const { data } = await supabase
        .from('credit_reactions')
        .select('id')
        .eq('credit_id', item.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setHasReacted(!!data);
    }
  };

  const handleReaction = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in to react", variant: "destructive" });
      return;
    }

    try {
      if (hasReacted) {
        // Remove reaction
        await supabase
          .from('credit_reactions')
          .delete()
          .eq('credit_id', item.id)
          .eq('user_id', user.id);

        setHasReacted(false);
        setReactionCount(prev => Math.max(0, prev - 1));
      } else {
        // Add reaction
        await supabase
          .from('credit_reactions')
          .insert({
            credit_id: item.id,
            user_id: user.id
          });

        setHasReacted(true);
        setReactionCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const renderMedia = () => {
    // If there's an embed code, sanitize it to prevent XSS
    if (item.embed_code) {
      const sanitizedEmbed = DOMPurify.sanitize(item.embed_code, {
        ALLOWED_TAGS: ['iframe', 'div'], // Removed 'script' for security
        ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'class'], // Removed 'style' and 'target'
        ALLOWED_URI_REGEXP: /^https?:\/\/(www\.)?(youtube|vimeo|spotify|soundcloud|dailymotion|twitch)\.com/,
        FORBID_TAGS: ['script', 'object', 'embed', 'link'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
      });
      
      return (
        <div 
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: sanitizedEmbed }}
        />
      );
    }

    // Get thumbnail using utility function
    const thumbnailUrl = getMediaThumbnail(item);
    
    if (thumbnailUrl) {
      return (
        <img 
          src={thumbnailUrl} 
          alt={item.title}
          className="w-full h-full object-cover"
        />
      );
    }

    // Default play icon for video/audio
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
        <Play className="h-16 w-16 text-primary/50" />
      </div>
    );
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-all">
        <div 
          className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer group"
          onClick={() => {
            // Don't open modal if it's an embed
            if (item.embed_code) return;
            if (isPlayable) {
              setShowPlayer(true);
            } else {
              window.open(item.media_url, '_blank');
            }
          }}
        >
          {renderMedia()}
          
          {isPlayable && !item.embed_code && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-16 w-16 text-white" />
            </div>
          )}

          <Badge className="absolute top-2 right-2 bg-background/90 backdrop-blur">
            <Sparkles className="h-3 w-3 mr-1" />
            Portfolio
          </Badge>
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={item.profiles.avatar_url || undefined} />
              <AvatarFallback>{item.profiles.full_name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{item.profiles.full_name}</p>
              <p className="text-xs text-muted-foreground">{item.profiles.role}</p>
            </div>
          </div>

          {/* Title & Description */}
          <h3 className="font-semibold mb-1">{item.title}</h3>
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {item.view_count}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReaction}
                className={`h-7 px-2 gap-1 ${hasReacted ? 'text-orange-500' : ''}`}
              >
                <Flame className={`h-4 w-4 ${hasReacted ? 'fill-orange-500' : ''}`} />
                <span className="font-semibold">{reactionCount}</span>
              </Button>
            </div>
            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </Card>

      {isPlayable && showPlayer && (
        <MediaPlayerModal
          isOpen={showPlayer}
          onClose={() => setShowPlayer(false)}
          item={{
            title: item.title,
            description: item.description || '',
            media_type: item.media_type,
            media_url: item.media_url
          }}
        />
      )}
    </>
  );
};