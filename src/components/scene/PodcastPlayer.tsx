import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Headphones, ExternalLink, Play, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { SmartWidget } from "@/components/ui/smart-widget";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PLAYLIST_ID = "PL3IHAVyb_6H2OpHnvwDa7EubXaanmXfOY";

interface Episode {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

export const PodcastPlayer = () => {
  const reducedMotion = useReducedMotion();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-youtube-playlist", {
        body: { playlistId: PLAYLIST_ID },
      });
      if (error) throw error;
      if (data?.episodes?.length) {
        setEpisodes(data.episodes);
        setActiveEpisode(data.episodes[0].videoId);
      }
    } catch (e) {
      console.error("Failed to fetch episodes:", e);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEpisodes(); }, []);

  const activeEp = episodes.find(e => e.videoId === activeEpisode);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <Headphones className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">Discover A Thriver</h3>
          <p className="text-[11px] text-muted-foreground">
            A backstage pass to the creative industry from leading professionals • {episodes.length} episodes
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <a href={`https://youtube.com/playlist?list=${PLAYLIST_ID}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" />
            YouTube
          </a>
        </Button>
      </div>

      {/* Active Player */}
      {activeEpisode && (
        <SmartWidget className="rounded-xl" scanLine interactive={false}>
        <Card className="overflow-hidden border-border/50 rounded-xl border-0">
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${activeEpisode}?rel=0`}
              title={activeEp?.title || "Discover A Thriver"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
          {activeEp && (
            <div className="p-3 border-t border-border/50 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-xs font-semibold line-clamp-1">{activeEp.title}</h4>
                {activeEp.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{activeEp.description}</p>
                )}
              </div>
              <SocialShareButtons
                url={`https://youtube.com/watch?v=${activeEp.videoId}`}
                title={activeEp.title}
                description="Discover A Thriver — Kretopia's podcast"
              />
            </div>
          )}
        </Card>
        </SmartWidget>
      )}

      {/* Episode List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <p className="text-xs font-medium">Couldn't load episodes</p>
          <button
            onClick={fetchEpisodes}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            All Episodes
          </p>
          <Carousel opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Podcast episodes">
            <CarouselContent className="-ml-3">
              {episodes.map((ep) => (
                <CarouselItem key={ep.videoId} className="pl-3 basis-[70%] sm:basis-[45%]">
                  <SmartWidget className="rounded-xl h-full" scanLine={false}>
                  <Card
                    onClick={() => setActiveEpisode(ep.videoId)}
                    className={cn(
                      "cursor-pointer transition-all rounded-xl border-0 h-full overflow-hidden",
                      activeEpisode === ep.videoId && "bg-primary/5"
                    )}
                  >
                    <div className="relative aspect-video w-full">
                      <img
                        src={ep.thumbnail}
                        alt={ep.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {activeEpisode !== ep.videoId && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white fill-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <h4 className="text-xs font-semibold line-clamp-2 leading-tight">{ep.title}</h4>
                      {ep.publishedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(ep.publishedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </Card>
                  </SmartWidget>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous episodes" />
            <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next episodes" />
          </Carousel>
        </div>
      )}

      {/* Audio Platforms */}
      <Card className="p-3.5 border-dashed border-border/50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold">Audio platforms coming soon</p>
            <p className="text-[10px] text-muted-foreground">Spotify, Apple Podcasts & more</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
