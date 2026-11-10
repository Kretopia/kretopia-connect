import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KretoScene } from "@/components/brand/KretoScene";
import { MoreHorizontal, Share2, Ticket } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const CATEGORY_LABELS: Record<string, string> = {
  music: "Music", film: "Film", photo: "Photo", art: "Art",
  podcast: "Podcast", workshop: "Workshop", networking: "Networking",
  content: "Content", festival: "Festival", showcase: "Showcase",
  general: "Creative",
};

interface EventHeroCardProps {
  event: { title: string; category?: string | null; cover_image_url?: string | null };
  /** The viewer has a pass to show (a signed-in member with a place). */
  hasPass: boolean;
  onShare: () => void;
  onShowGuestPass: () => void;
}

/**
 * The event's cover and its name: a picture, a category, the title, and a "More" menu for share and the viewer's pass. It states nothing
 * else about the event. When, where, the price, the host and who is going are said once, in the booking block beside it, and the one
 * booking control lives there too, so the cover is only the cover.
 */
export function EventHeroCard({ event, hasPass, onShare, onShowGuestPass }: EventHeroCardProps) {
  const [coverImageFailed, setCoverImageFailed] = useState(false);

  useEffect(() => {
    setCoverImageFailed(false);
  }, [event.cover_image_url]);

  return (
    // The cover keeps its shape, and grows (min-h-min) when a long title needs more room: the title is in the flow, so it is never clipped
    // and never slides under the "More" button, which the padding above it keeps clear.
    <header id="hero" aria-labelledby="event-title" className="relative flex aspect-[16/9] min-h-min w-full flex-col justify-end overflow-hidden rounded-2xl bg-muted sm:aspect-[16/7]">
      {event.cover_image_url && !coverImageFailed ? (
        <img
          src={event.cover_image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_45%]"
          onError={() => setCoverImageFailed(true)}
        />
      ) : <KretoScene scene="soundstages" size="thumb" className="absolute inset-0 h-full w-full" />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/5" />
      <div className="absolute right-3 top-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" aria-label="More event actions">
              <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onShare}><Share2 className="mr-2 h-4 w-4" aria-hidden />Share event</DropdownMenuItem>
            {hasPass && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onShowGuestPass}><Ticket className="mr-2 h-4 w-4" aria-hidden />My pass</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative p-4 pt-14 sm:p-6 sm:pt-16">
        {event.category && <Badge variant="secondary" className="mb-2">{CATEGORY_LABELS[event.category] || event.category}</Badge>}
        <h1 id="event-title" tabIndex={-1} className="max-w-4xl text-2xl font-bold leading-tight tracking-tight text-foreground focus-visible:outline-none sm:text-5xl">
          {event.title}
        </h1>
      </div>
    </header>
  );
}

export default EventHeroCard;
