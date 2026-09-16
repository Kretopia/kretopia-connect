import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MagazineArticleViewer } from "./MagazineArticleViewer";

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  cover_image_url: string | null;
  cover_position_x?: number | null;
  cover_position_y?: number | null;
  cover_zoom?: number | null;
  category: string;
  author_name: string;
  author_avatar_url: string | null;
  read_time_minutes: number;
  view_count: number;
  like_count?: number | null;
  comment_count?: number | null;
  created_at: string;
  slug?: string | null;
}

interface MagazineArticleModalProps {
  article: Article | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Kretopia-branded article reader — every story from the Wall opens
 * here instead of swapping out the whole page, so "back to browsing" is
 * always one click (or an outside click / Escape) away. Same ambient
 * pink aurora + grain plate as EditorialPageHero/HoloCard, scaled down to
 * a modal chrome instead of a full page.
 */
export function MagazineArticleModal({ article, onOpenChange }: MagazineArticleModalProps) {
  return (
    <Dialog open={!!article} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-1.5rem)] h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl border-[hsl(var(--energy)/0.25)] [&>button]:z-20 [&>button]:bg-background/80 [&>button]:backdrop-blur-sm [&>button]:rounded-full">
        <DialogTitle className="sr-only">{article?.title || "Article"}</DialogTitle>
        {/* Ambient plate — the same signal that this is a Kretopia surface
            (aurora glow) as every other big editorial moment in the app. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 ai-ambient-breathe"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, hsl(var(--energy)/0.14), transparent 70%)" }}
        />
        <div className="relative h-full overflow-y-auto">
          {article && (
            <MagazineArticleViewer article={article} onBack={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MagazineArticleModal;
