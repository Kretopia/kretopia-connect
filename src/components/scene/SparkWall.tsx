import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, MessageCircle, Paperclip, Loader2, Play, Music, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseMediaUrl } from "@/lib/mediaUtils";
import { AudioWaveformPlayer } from "@/components/profile/AudioWaveformPlayer";
import { SparkComposer } from "@/components/scene/SparkComposer";

interface SparkPost {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: any;
  media_type: string | null;
  post_type: string;
  created_at: string;
  portfolio_item_id: string | null;
  auto_activity_message: string | null;
  is_portfolio_item: boolean | null;
  is_ai_generated: boolean;
  category: string | null;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    role: string | null;
  };
  portfolio_item?: {
    title: string;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    description: string | null;
    embed_code: string | null;
    category: string | null;
  };
  reaction_count: number;
  comment_count: number;
  has_reacted: boolean;
  has_clipped: boolean;
}

export const SparkWall = () => {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<SparkPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string; avatar_url: string | null; role: string | null } | null>(null);
  const hasFetched = useRef(false);

  const fetchPosts = useCallback(async () => {
    try {
      // Fetch both portfolio items AND user-created spark posts in parallel
      const [portfolioRes, sparkPostsRes] = await Promise.all([
        supabase.from("credits").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("feed_posts").select("*").in("source_type", ["spark", "ai_spark"]).order("created_at", { ascending: false }).limit(20),
      ]);

      const portfolioItems = portfolioRes.data || [];
      const sparkPosts = sparkPostsRes.data || [];

      // Collect all user IDs
      const allUserIds = [...new Set([
        ...portfolioItems.map(p => p.user_id),
        ...sparkPosts.map(p => p.user_id),
      ])];
      const portfolioIds = portfolioItems.map(p => p.id);

      const [profilesResult, linkedPostsResult] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, role").in("user_id", allUserIds),
        portfolioIds.length > 0 ? supabase.from("feed_posts").select("id, portfolio_item_id").in("portfolio_item_id", portfolioIds) : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map<string, any>(profilesResult.data?.map(p => [p.user_id, p] as [string, any]) || []);
      const postIdMap = new Map<string, string>(linkedPostsResult.data?.map(lp => [lp.portfolio_item_id, lp.id] as [string, string]) || []);

      // Set user profile for composer
      if (userRef.current) {
        setUserProfile(profileMap.get(userRef.current.id) || null);
      }

      // Portfolio items as posts
      const portfolioPosts: SparkPost[] = portfolioItems.map(item => ({
        id: postIdMap.get(item.id) || item.id,
        user_id: item.user_id,
        content: null,
        media_urls: null,
        media_type: item.media_type,
        post_type: "portfolio",
        created_at: item.created_at,
        portfolio_item_id: item.id,
        auto_activity_message: null,
        is_portfolio_item: true,
        is_ai_generated: false,
        category: item.credit_category,
        profile: profileMap.get(item.user_id) || { full_name: "Unknown", avatar_url: null, role: null },
        portfolio_item: {
          title: item.project_name,
          media_url: item.primary_media_url,
          media_type: item.media_type,
          thumbnail_url: item.thumbnail_url,
          description: item.description,
          embed_code: (item.metadata as any)?.embed_code,
          category: item.credit_category,
        },
        reaction_count: 0, comment_count: 0, has_reacted: false, has_clipped: false,
      }));

      // User-created spark posts (text, links, media)
      const userPosts: SparkPost[] = sparkPosts.map(sp => ({
        id: sp.id,
        user_id: sp.user_id,
        content: sp.content,
        media_urls: sp.media_urls,
        media_type: sp.media_type,
        post_type: sp.post_type || "text",
        created_at: sp.created_at,
        portfolio_item_id: null,
        auto_activity_message: null,
        is_portfolio_item: false,
        is_ai_generated: !!(sp as any).is_ai_generated || (sp as any).source_type === "ai_spark",
        category: sp.category,
        profile: profileMap.get(sp.user_id) || { full_name: "Unknown", avatar_url: null, role: null },
        portfolio_item: undefined,
        reaction_count: 0, comment_count: 0, has_reacted: false, has_clipped: false,
      }));

      // Sort user posts (sparks) first by recency, then shuffle portfolio items among them
      const sortedUserPosts = [...userPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Shuffle portfolio posts
      const shuffledPortfolio = [...portfolioPosts];
      for (let i = shuffledPortfolio.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPortfolio[i], shuffledPortfolio[j]] = [shuffledPortfolio[j], shuffledPortfolio[i]];
      }
      
      // Interleave: user posts first, then sprinkle portfolio items
      const enriched: SparkPost[] = [];
      let pIdx = 0;
      for (let i = 0; i < sortedUserPosts.length; i++) {
        enriched.push(sortedUserPosts[i]);
        // Insert a portfolio item every 2 user posts
        if ((i + 1) % 2 === 0 && pIdx < shuffledPortfolio.length) {
          enriched.push(shuffledPortfolio[pIdx++]);
        }
      }
      // Add remaining portfolio items
      while (pIdx < shuffledPortfolio.length) {
        enriched.push(shuffledPortfolio[pIdx++]);
      }
      setPosts(enriched);
      setLoading(false);

      // Enrich reactions/clips in background
      const feedPostIds = [
        ...(linkedPostsResult.data?.map(lp => lp.id) || []),
        ...sparkPosts.map(sp => sp.id),
      ];
      if (feedPostIds.length > 0) {
        const currentUser = userRef.current;
        const [reactionsResult, clipsResult] = await Promise.all([
          supabase.from("feed_reactions").select("post_id, user_id").in("post_id", feedPostIds),
          currentUser ? supabase.from("feed_clips").select("post_id").eq("user_id", currentUser.id).in("post_id", feedPostIds) : Promise.resolve({ data: [] }),
        ]);

        const reactionCounts = new Map<string, number>();
        const userReactions = new Set<string>();
        reactionsResult.data?.forEach(r => {
          reactionCounts.set(r.post_id, (reactionCounts.get(r.post_id) || 0) + 1);
          if (r.user_id === currentUser?.id) userReactions.add(r.post_id);
        });
        const clippedPosts = new Set(clipsResult.data?.map((c: any) => c.post_id) || []);

        setPosts(prev => prev.map(p => ({
          ...p,
          reaction_count: reactionCounts.get(p.id) || p.reaction_count,
          has_reacted: userReactions.has(p.id) || p.has_reacted,
          has_clipped: clippedPosts.has(p.id) || p.has_clipped,
        })));
      }
    } catch (err) {
      console.error("Error fetching spark posts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchPosts();
  }, [fetchPosts]);

  const handleReaction = async (post: SparkPost) => {
    if (!user) return;
    // Need a feed_post id to react — create one if it doesn't exist
    let postId = post.id;
    if (post.portfolio_item_id && !post.has_reacted && post.reaction_count === 0) {
      // Check if feed post exists
      const { data: existing } = await supabase
        .from("feed_posts")
        .select("id")
        .eq("portfolio_item_id", post.portfolio_item_id)
        .maybeSingle();
      
      if (existing) {
        postId = existing.id;
      } else {
        // Create feed post for this portfolio item
        const { data: newPost } = await supabase
          .from("feed_posts")
          .insert({
            user_id: post.user_id,
            post_type: "portfolio",
            portfolio_item_id: post.portfolio_item_id,
            is_portfolio_item: true,
          })
          .select("id")
          .single();
        if (newPost) postId = newPost.id;
      }
    }

    if (post.has_reacted) {
      await supabase.from("feed_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("feed_reactions").insert({ post_id: postId, user_id: user.id, reaction_type: "fire" });
    }
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      id: postId,
      has_reacted: !post.has_reacted,
      reaction_count: post.has_reacted ? p.reaction_count - 1 : p.reaction_count + 1,
    } : p));
  };

  const handleClip = async (post: SparkPost) => {
    if (!user) return;
    let postId = post.id;
    
    // Ensure feed_post exists
    if (post.portfolio_item_id) {
      const { data: existing } = await supabase
        .from("feed_posts")
        .select("id")
        .eq("portfolio_item_id", post.portfolio_item_id)
        .maybeSingle();
      if (existing) postId = existing.id;
    }

    if (post.has_clipped) {
      await supabase.from("feed_clips").delete().eq("post_id", postId).eq("user_id", user.id);
      toast({ title: "Unclipped", description: "Removed from your clips" });
    } else {
      await supabase.from("feed_clips").insert({ post_id: postId, user_id: user.id });
      toast({ title: "Clipped! 📎", description: "Saved to your collection" });
    }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, has_clipped: !post.has_clipped } : p));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="space-y-4">
        <SparkComposer userProfile={userProfile} onPostCreated={() => { hasFetched.current = false; fetchPosts(); }} />
        <Card className="p-6 text-center border-dashed border-2 border-border/60">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-energy/15 flex items-center justify-center">
            <Flame className="h-6 w-6 text-energy" />
          </div>
          <p className="font-semibold mb-1 text-sm">Be the first to spark the scene</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Share your latest work, a behind-the-scenes moment, or what you're creating right now. Your community is waiting.
          </p>
        </Card>
      </div>
    );
  }

  const handleRefresh = () => {
    hasFetched.current = false;
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      <SparkComposer userProfile={userProfile} onPostCreated={handleRefresh} />
      {posts.map(post => (
        post.is_portfolio_item && post.portfolio_item ? (
          <SparkMediaCard
            key={post.id}
            post={post}
            onReact={() => handleReaction(post)}
            onClip={() => handleClip(post)}
            onNavigate={(userId) => navigate(`/profile/${userId}`)}
          />
        ) : (
          <SparkTextCard
            key={post.id}
            post={post}
            onReact={() => handleReaction(post)}
            onClip={() => handleClip(post)}
            onNavigate={(userId) => navigate(`/profile/${userId}`)}
          />
        )
      ))}
    </div>
  );
};

// Rich media card — plays inline like Instagram/TikTok
const SparkMediaCard = ({ 
  post, onReact, onClip, onNavigate 
}: { 
  post: SparkPost; 
  onReact: () => void; 
  onClip: () => void; 
  onNavigate: (userId: string) => void;
}) => {
  const item = post.portfolio_item;
  if (!item) return null;

  const mediaUrl = item.media_url;
  const mediaInfo = parseMediaUrl(mediaUrl);
  const isDirectVideo = item.media_type === "video" && !mediaInfo;
  const isDirectAudio = item.media_type === "audio" && !mediaInfo;
  const isDirectImage = item.media_type === "image" && !mediaInfo;
  const isEmbed = !!mediaInfo;
  const categoryEmoji = getCategoryEmoji(item.category || post.category);

  return (
    <Card className="overflow-hidden border-border/50">
      {/* Creator Header */}
      <div 
        className="flex items-center gap-2.5 p-3 pb-2 cursor-pointer"
        onClick={() => onNavigate(post.user_id)}
      >
        <Avatar className="h-8 w-8 ring-2 ring-primary/20">
          <AvatarImage src={post.profile?.avatar_url || ""} />
          <AvatarFallback className="text-xs">{post.profile?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate hover:text-primary transition-colors">
            {post.profile?.full_name}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {post.profile?.role} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {post.is_ai_generated && (
          <Badge variant="secondary" className="text-[10px] shrink-0 gap-0.5 bg-primary/10 text-primary border-primary/20 py-0">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </Badge>
        )}
        {categoryEmoji && (
          <Badge variant="secondary" className="text-xs shrink-0 gap-1">
            {categoryEmoji}
          </Badge>
        )}
      </div>

      {/* Rich Media Area */}
      <div className="relative bg-muted/30">
        {/* Embedded players (YouTube, Spotify, SoundCloud, etc.) */}
        {isEmbed && (
          <EmbedPlayer mediaInfo={mediaInfo} mediaType={item.media_type} />
        )}

        {/* Direct video playback */}
        {isDirectVideo && (
          <InlineVideoPlayer src={mediaUrl} thumbnail={item.thumbnail_url} />
        )}

        {/* Direct audio with waveform */}
        {isDirectAudio && (
          <div className="p-4">
            {item.thumbnail_url && (
              <div className="flex justify-center mb-3">
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-muted">
                  <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                    <Music className="h-8 w-8 text-primary/60" />
                  </div>
                </div>
              </div>
            )}
            <AudioWaveformPlayer src={mediaUrl} title={item.title} />
          </div>
        )}

        {/* Image */}
        {isDirectImage && (
          <img
            src={mediaUrl}
            alt={item.title}
            className="w-full max-h-[500px] object-cover cursor-pointer"
            loading="lazy"
            onClick={() => onNavigate(post.user_id)}
          />
        )}

        {/* Fallback: thumbnail with play overlay for unrecognized URLs */}
        {!isEmbed && !isDirectVideo && !isDirectAudio && !isDirectImage && item.thumbnail_url && (
          <div className="relative">
            <img
              src={item.thumbnail_url}
              alt={item.title}
              className="w-full max-h-[400px] object-cover"
              loading="lazy"
            />
            <a 
              href={mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-background/20 hover:bg-background/30 transition-colors"
            >
              <div className="h-14 w-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                <Play className="h-6 w-6 text-primary fill-primary ml-0.5" />
              </div>
            </a>
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div className="px-3 pt-2">
        <h3 className="font-semibold text-sm">{item.title}</h3>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 h-8", post.has_reacted && "text-energy")}
          onClick={onReact}
        >
          <Flame className={cn("h-4 w-4", post.has_reacted && "fill-energy text-energy")} />
          {post.reaction_count > 0 && <span className="text-xs font-medium">{post.reaction_count}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8"
          onClick={() => onNavigate(post.user_id)}
        >
          <MessageCircle className="h-4 w-4" />
          {post.comment_count > 0 && <span className="text-xs font-medium">{post.comment_count}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 h-8 ml-auto", post.has_clipped && "text-energy")}
          onClick={onClip}
        >
          <Paperclip className={cn("h-4 w-4", post.has_clipped && "fill-primary/20")} />
        </Button>
      </div>
    </Card>
  );
};

// Text/link post card — styled as a visual card so it doesn't break the media-first aesthetic
const SparkTextCard = ({ 
  post, onReact, onClip, onNavigate 
}: { 
  post: SparkPost; 
  onReact: () => void; 
  onClip: () => void; 
  onNavigate: (userId: string) => void;
}) => {
  const mediaUrls = post.media_urls as string[] | null;
  const hasMedia = mediaUrls && mediaUrls.length > 0;
  const isImage = hasMedia && post.media_type === "image";
  const isVideo = hasMedia && post.media_type === "video";

  return (
    <Card className="overflow-hidden border-border/50">
      {/* Creator Header */}
      <div className="flex items-center gap-2.5 p-3 pb-2 cursor-pointer" onClick={() => onNavigate(post.user_id)}>
        <Avatar className="h-8 w-8 ring-2 ring-primary/20">
          <AvatarImage src={post.profile?.avatar_url || ""} />
          <AvatarFallback className="text-xs">{post.profile?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate hover:text-primary transition-colors">{post.profile?.full_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {post.profile?.role} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {post.is_ai_generated && (
          <Badge variant="secondary" className="text-[10px] shrink-0 gap-0.5 bg-primary/10 text-primary border-primary/20 py-0">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </Badge>
        )}
      </div>

      {/* Text content as visual card */}
      {post.content && !hasMedia && (
        <div className="mx-3 mb-2 p-4 rounded-xl bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5 border border-primary/10">
          <p className="text-sm leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Text + media */}
      {post.content && hasMedia && (
        <div className="px-3 pb-1">
          <p className="text-sm">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {isImage && <img src={mediaUrls![0]} alt="shared" className="w-full max-h-[500px] object-cover" loading="lazy" />}
      {isVideo && (
        <video src={mediaUrls![0]} controls className="w-full max-h-[500px]" preload="metadata" />
      )}

      {/* Action Bar */}
      <div className="flex items-center px-2 py-1.5">
        <Button variant="ghost" size="sm" className={cn("gap-1.5 h-8", post.has_reacted && "text-energy")} onClick={onReact}>
          <Flame className={cn("h-4 w-4", post.has_reacted && "fill-energy text-energy")} />
          {post.reaction_count > 0 && <span className="text-xs font-medium">{post.reaction_count}</span>}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => onNavigate(post.user_id)}>
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 h-8 ml-auto", post.has_clipped && "text-energy")} onClick={onClip}>
          <Paperclip className={cn("h-4 w-4", post.has_clipped && "fill-energy/20 text-energy")} />
        </Button>
      </div>
    </Card>
  );
};


const EmbedPlayer = ({ mediaInfo, mediaType }: { mediaInfo: NonNullable<ReturnType<typeof parseMediaUrl>>; mediaType: string }) => {
  const isAudio = mediaInfo.platform === "spotify" || mediaInfo.platform === "soundcloud";
  
  return (
    <div className={cn(
      "w-full overflow-hidden",
      isAudio ? "aspect-[16/9]" : "aspect-video"
    )}>
      <iframe
        src={mediaInfo.embedUrl}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        title="Media player"
      />
    </div>
  );
};

// Inline video player with play/pause and mute toggle
const InlineVideoPlayer = ({ src, thumbnail }: { src: string; thumbnail?: string | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="relative group cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail || undefined}
        className="w-full max-h-[500px] object-cover"
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />
      {/* Play overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20">
          <div className="h-14 w-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
            <Play className="h-6 w-6 text-primary fill-primary ml-0.5" />
          </div>
        </div>
      )}
      {/* Mute toggle */}
      {playing && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-3 right-3 h-8 w-8 bg-background/70 backdrop-blur-sm hover:bg-background/90"
          onClick={(e) => {
            e.stopPropagation();
            setMuted(!muted);
            if (videoRef.current) videoRef.current.muted = !muted;
          }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
};

function getCategoryEmoji(category: string | null): string | null {
  if (!category) return null;
  const map: Record<string, string> = {
    music: "", film: "", photo: "", art: "", design: "",
    video: "", audio: "", podcast: "🎙", writing: "✍",
  };
  return map[category.toLowerCase()] || null;
}
