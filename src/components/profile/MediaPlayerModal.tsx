import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseMediaUrl } from "@/lib/mediaUtils";
import { ExternalLink, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";

interface MediaPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    title: string;
    description?: string | null;
    media_type: string;
    media_url: string;
    thumbnail_url?: string | null;
  } | null;
}

export const MediaPlayerModal = ({ isOpen, onClose, item }: MediaPlayerModalProps) => {
  if (!item) return null;
  
  const mediaInfo = parseMediaUrl(item.media_url);

  const renderPlayer = () => {
    // If we have platform-specific embed info (Spotify, SoundCloud, YouTube, etc.)
    if (mediaInfo) {
      // For Spotify/SoundCloud audio embeds, use larger height
      const isAudioEmbed = mediaInfo.platform === 'spotify' || mediaInfo.platform === 'soundcloud';
      
      return (
        <div className={`w-full rounded-lg overflow-hidden bg-black ${isAudioEmbed ? 'aspect-[4/3]' : 'aspect-video'}`}>
          <iframe
            src={mediaInfo.embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    // Direct audio files - use waveform player
    if (item.media_type === 'audio') {
      return (
        <div className="space-y-4">
          {/* Album art / thumbnail */}
          {item.thumbnail_url && (
            <div className="flex justify-center">
              <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-muted">
                <img 
                  src={item.thumbnail_url} 
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                  <Music className="h-16 w-16 text-primary/60" />
                </div>
              </div>
            </div>
          )}
          <AudioWaveformPlayer 
            src={item.media_url} 
            title={item.title}
            autoPlay 
          />
        </div>
      );
    }

    // Video files
    if (item.media_type === 'video') {
      return (
        <video
          src={item.media_url}
          controls
          autoPlay
          className="w-full aspect-video rounded-lg bg-black"
        />
      );
    }

    // Image files
    if (item.media_type === 'image') {
      return (
        <img
          src={item.media_url}
          alt={item.title}
          className="w-full max-h-[70vh] object-contain rounded-lg"
        />
      );
    }

    // Default fallback
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Media preview not available</p>
        <Button variant="outline" asChild>
          <a href={item.media_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </a>
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>Media preview</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {renderPlayer()}
          {item.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
