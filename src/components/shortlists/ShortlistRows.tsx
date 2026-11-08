import { Bookmark, ChevronRight, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardRow } from "@/components/cards/CardRow";
import { CARD_ICON_BTN } from "@/components/cards/cardTokens";

interface ShortlistRowProps {
  name: string;
  itemCount: number;
  previewAvatars?: string[];
  onOpen: () => void;
}

/** One of the viewer's shortlists, as a row of the shared card: the first few people in it, its name and how many there are. The row opens it. */
export function ShortlistRow({ name, itemCount, previewAvatars = [], onOpen }: ShortlistRowProps) {
  return (
    <CardRow
      title={name}
      open={{ onClick: onOpen }}
      lead={
        <div className="flex -space-x-2">
          {previewAvatars.slice(0, 3).map((src, i) => (
            <Avatar key={i} className="h-8 w-8 border-2 border-background">
              <AvatarImage src={src} />
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
          ))}
          {previewAvatars.length === 0 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>
      }
      meta={`${itemCount} ${itemCount === 1 ? "creator" : "creators"}`}
      trailing={<ChevronRight className="h-4 w-4" aria-hidden />}
    />
  );
}

interface ShortlistCreatorRowProps {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  /** Where their Passport is: their handle when they have one, otherwise their id. */
  profilePath: string;
  onRemove: () => void;
}

/** A creator in a shortlist, as a row of the shared card. The row opens their Passport; the trash icon removes them from the list and nothing else. */
export function ShortlistCreatorRow({ id, fullName, jobTitle, avatarUrl, profilePath, onRemove }: ShortlistCreatorRowProps) {
  return (
    <CardRow
      testId={`shortlist-item-${id}`}
      title={fullName || "Unknown creator"}
      open={{ to: profilePath }}
      lead={
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback>{(fullName || "?").slice(0, 1)}</AvatarFallback>
        </Avatar>
      }
      meta={jobTitle || null}
      controls={
        <button type="button" className={CARD_ICON_BTN} onClick={onRemove} aria-label="Remove from list">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      }
    />
  );
}
