import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, ExternalLink, Play } from "lucide-react";
import { getBestPlayableMediaUrl, getModalMediaType } from "@/lib/mediaUtils";
import { MediaPlayerModal } from "@/components/profile/MediaPlayerModal";

interface CreditActivityCardProps {
  item: {
    id: string;
    project_name: string;
    role: string;
    platform: string | null;
    year: number | null;
    thumbnail_url: string | null;
    url: string | null;
    primary_media_url?: string | null;
    media_url?: string | null;
    media_type?: string | null;
    created_at: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  };
}

export const CreditActivityCard = ({ item }: CreditActivityCardProps) => {
  const [open, setOpen] = useState(false);
  const playableUrl = getBestPlayableMediaUrl(item);
  const fallbackUrl = item.url || item.primary_media_url || item.media_url || null;
  const isPlayable = !!playableUrl;

  const handleCardClick = () => {
    if (playableUrl) {
      setOpen(true);
    } else if (fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  };

  const mediaType = getModalMediaType(playableUrl, item.media_type);

  return (
    <>
      <Card
        onClick={handleCardClick}
        className={`overflow-hidden hover:shadow-lg transition-all ${fallbackUrl ? "cursor-pointer" : ""}`}
      >
        {item.thumbnail_url && (
          <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 group">
            <img
              src={item.thumbnail_url}
              alt={item.project_name}
              className="w-full h-full object-cover"
            />
            <Badge className="absolute top-2 right-2 bg-background/90">
              <Briefcase className="h-3 w-3 mr-1 text-primary" />
              Credit
            </Badge>
            {isPlayable && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center">
                  <Play className="h-6 w-6 text-black ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
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

          <div className="flex items-start gap-3">
            {!item.thumbnail_url && (
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {isPlayable ? <Play className="h-6 w-6 text-primary" /> : <Briefcase className="h-6 w-6 text-primary" />}
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{item.project_name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {item.role} {item.platform && `• ${item.platform}`} {item.year && `• ${item.year}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            {fallbackUrl ? (
              <span className="flex items-center gap-1">
                {isPlayable ? <Play className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                {isPlayable ? "Tap to play" : "View Project"}
              </span>
            ) : (
              <div />
            )}
            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </Card>

      <MediaPlayerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        item={playableUrl ? {
          title: item.project_name,
          description: `${item.role}${item.year ? ` · ${item.year}` : ""}`,
          media_type: mediaType,
          media_url: playableUrl,
          thumbnail_url: item.thumbnail_url,
        } : null}
      />
    </>
  );
};
