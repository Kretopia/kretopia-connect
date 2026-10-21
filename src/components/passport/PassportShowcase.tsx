import { useState } from "react";
import { Layers, Music2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCarousel, GlassCarouselItem } from "@/components/ui/glass/GlassCarousel";
import { creditEvidenceLabel, creditEvidenceMeaning } from "@/lib/passport/creditEvidence";
import {
  buildShowcase,
  type MediaShowcaseItem,
  type ProjectShowcaseItem,
  type ShowcaseCredit,
  type ShowcasePiece,
} from "@/lib/passport/showcase";
import { cn } from "@/lib/utils";

interface PassportShowcaseProps<P extends ShowcasePiece> {
  pieces: readonly P[];
  credits: readonly ShowcaseCredit[];
  /** Opens a video or audio piece in the player. Nothing plays until it is pressed. */
  onOpenMedia: (piece: P) => void;
  className?: string;
}

const ITEM = "basis-[72%] pl-3 sm:basis-1/2 lg:basis-1/3";

/** A cover image that falls back to a neutral tile when it is missing or fails to load. */
function Cover({ src, children, className }: { src: string | null; children: React.ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-lg bg-muted", className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

function MediaCard<P extends ShowcasePiece>({ item, onOpen }: { item: MediaShowcaseItem<P>; onOpen: (piece: P) => void }) {
  const isAudio = item.kind === "audio";
  const Icon = isAudio ? Music2 : Play;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.piece)}
      aria-label={`${isAudio ? "Listen to" : "Play"} ${item.title}`}
      className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Cover src={item.thumbnailUrl}>
        <Icon className="h-6 w-6" aria-hidden />
      </Cover>
      <span className="pointer-events-none relative -mt-11 mb-2 ml-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground shadow transition-transform group-hover:scale-105 motion-reduce:transition-none">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="line-clamp-2 break-words text-sm font-semibold text-foreground">{item.title}</span>
    </button>
  );
}

function ProjectCard({ item }: { item: ProjectShowcaseItem }) {
  return (
    <article className="w-full">
      <Cover src={item.thumbnailUrl}>
        <Layers className="h-6 w-6" aria-hidden />
      </Cover>
      <h4 className="mt-2 line-clamp-2 break-words text-sm font-semibold text-foreground">{item.title}</h4>
      {item.subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>}
      {item.proof && (
        <Badge variant="outline" className="mt-1.5 h-5 px-1.5 text-[10px] font-medium" title={creditEvidenceMeaning(item.proof)}>
          {creditEvidenceLabel(item.proof)}
        </Badge>
      )}
    </article>
  );
}

/**
 * A creative's work as Video, Audio and Projects, each a carousel (swipe, arrow keys, buttons on larger screens,
 * position dots). Which section something belongs to, and what counts as its proof, is decided in
 * `lib/passport/showcase.ts`. Sections with nothing in them are not drawn, covers load lazily, and no media element
 * exists until the player is opened.
 */
export function PassportShowcase<P extends ShowcasePiece>({ pieces, credits, onOpenMedia, className }: PassportShowcaseProps<P>) {
  const sections = buildShowcase(pieces, credits);
  if (sections.length === 0) return null;
  return (
    <div className={cn("space-y-6", className)}>
      {sections.map((section) => (
        <section key={section.kind} aria-labelledby={`showcase-${section.kind}`}>
          <h3 id={`showcase-${section.kind}`} className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{section.label}</h3>
          <GlassCarousel label={`${section.label}, work samples`}>
            {section.items.map((item) => (
              <GlassCarouselItem key={item.id} className={ITEM}>
                {item.kind === "project" ? <ProjectCard item={item} /> : <MediaCard item={item} onOpen={onOpenMedia} />}
              </GlassCarouselItem>
            ))}
          </GlassCarousel>
        </section>
      ))}
    </div>
  );
}

export default PassportShowcase;
