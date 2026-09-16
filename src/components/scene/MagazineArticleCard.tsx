import { Badge } from "@/components/ui/badge";
import { Clock, Heart, MessageCircle, Pencil, TrendingUp } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import { SmartCover } from "@/components/ui/smart-cover";
import { coverImageStyle } from "./CoverImageEditor";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  cover_position_x?: number | null;
  cover_position_y?: number | null;
  cover_zoom?: number | null;
  category: string;
  author_name: string;
  read_time_minutes: number;
  view_count: number;
  like_count?: number | null;
  comment_count?: number | null;
}

interface MagazineArticleCardProps {
  article: Article;
  categoryLabel: string;
  /** Large hero treatment for the one lead story, vs. the compact grid tile. */
  featured?: boolean;
  canEdit?: boolean;
  onOpen: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * The Kretopia Magazine "Holo Card" — every story on the Wall renders
 * through this one component (hero and grid alike) instead of the old
 * plain SmartWidget/Card tile, so the Magazine reads as a genuine
 * collectible-grade surface (same 3D tilt + holographic sheen HoloCard
 * gives the Passport and event passes), watermarked with the Kretopia
 * mark and carrying its own like/comment counts inline.
 */
export function MagazineArticleCard({
  article,
  categoryLabel,
  featured = false,
  canEdit = false,
  onOpen,
  onEdit,
  className,
}: MagazineArticleCardProps) {
  return (
    <HoloCard className={cn("h-full", className)} maxTilt={featured ? 6 : 4}>
      {/* A real <button> wrapping the whole card would nest the Edit
          button inside it (invalid HTML, and its click would still
          bubble up to open the article underneath). role="button" here
          gets the same keyboard/click affordance without that nesting. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-left"
      >
        <div className={cn("relative overflow-hidden", featured ? "aspect-[16/9]" : "aspect-[4/3]")}>
          <SmartCover
            src={article.cover_image_url}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={coverImageStyle(article.cover_position_x, article.cover_position_y, article.cover_zoom)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Kretopia watermark — a subtle "this came from the Magazine" mark
              in the corner of every cover, same mark as everywhere else in
              the app, never competing with the cover image itself. */}
          <img
            src={kMarkAsset.url}
            alt=""
            aria-hidden
            className={cn("absolute opacity-70 drop-shadow", featured ? "top-3 left-3 h-6 w-6" : "top-2 left-2 h-4 w-4")}
          />

          {featured && (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--energy))]/90 px-2 py-0.5 text-[10px] font-bold text-white">
              <TrendingUp className="h-3 w-3" />
              Featured
            </span>
          )}
          {canEdit && onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(e); }}
              className={cn(
                "absolute z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background flex items-center justify-center transition-colors",
                featured ? "top-3 right-3 h-8 w-8" : "top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100",
                featured && "right-16",
              )}
              aria-label="Edit article"
              title="Edit article"
            >
              <Pencil className={featured ? "h-3.5 w-3.5" : "h-3 w-3"} />
            </button>
          )}

          <div className={cn("absolute bottom-0 left-0 right-0", featured ? "p-4" : "p-2.5")}>
            <Badge variant="secondary" className={cn("capitalize", featured ? "mb-2 text-[10px]" : "mb-1 px-1.5 py-0 text-[9px]")}>
              {categoryLabel}
            </Badge>
            <h3 className={cn("font-bold leading-tight text-white", featured ? "text-lg mb-1" : "text-xs line-clamp-2 font-semibold")}>
              {article.title}
            </h3>
            {featured && article.subtitle && (
              <p className="line-clamp-2 text-xs text-white/70">{article.subtitle}</p>
            )}
          </div>
        </div>

        <div className={cn("flex items-center justify-between text-muted-foreground", featured ? "p-4 text-[11px]" : "p-2.5 text-[10px]")}>
          <span className="truncate">{article.author_name}</span>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {article.read_time_minutes}m
            </span>
            {!!article.like_count && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {article.like_count}
              </span>
            )}
            {!!article.comment_count && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {article.comment_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </HoloCard>
  );
}

export default MagazineArticleCard;
