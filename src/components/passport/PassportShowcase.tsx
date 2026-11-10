import { useState } from "react";
import { Layers, Music2, Play } from "lucide-react";
import { KretoScene } from "@/components/brand/KretoScene";
import { Badge } from "@/components/ui/badge";
import { GlassCarousel, GlassCarouselItem } from "@/components/ui/glass/GlassCarousel";
import { creditSceneFor } from "@/lib/passport/creditArt";
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
  /** Opens a credit's project page (its roll call, where roles are claimed). Without it the credit cards are plain cards. */
  onOpenCredit?: (item: ProjectShowcaseItem) => void;
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

type CoverStage = "own" | "kreto" | "tile";

/**
 * A project's cover. Its own image when it has one; when there is none, or the image fails, one of Kreto's approved scenes chosen from the
 * project's id (see creditArt.ts), so the same credit always wears the same picture; and a neutral tile only if that file fails as well.
 * Each step is taken at most once and only forward, and the last step has no image to fail, so a broken URL can never loop.
 */
function ProjectCover({ id, src }: { id: string; src: string | null }) {
  const [stage, setStage] = useState<CoverStage>(src ? "own" : "kreto");
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      {stage === "own" && src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setStage("kreto")} className="h-full w-full object-cover" />
      ) : stage === "kreto" ? (
        <KretoScene scene={creditSceneFor(id)} size="thumb" className="h-full w-full" onError={() => setStage("tile")} />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground"><Layers className="h-6 w-6" aria-hidden /></div>
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

function ProjectCard({ item, onOpen }: { item: ProjectShowcaseItem; onOpen?: () => void }) {
  return (
    <article className={cn("w-full", onOpen && "group relative")}>
      {/* Keyed by the image too, so a refreshed cover starts from its own image again. */}
      <ProjectCover key={`${item.id}|${item.thumbnailUrl ?? ""}`} id={item.id} src={item.thumbnailUrl} />
      <h4 className="mt-2 line-clamp-2 break-words text-sm font-semibold text-foreground">
        {onOpen ? (
          // The whole card is the target: the button's own box is stretched over it, so the cover, the title and the role all open the project.
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${item.title}`}
            className="rounded-sm text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
          >
            {item.title}
          </button>
        ) : (
          item.title
        )}
      </h4>
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
 * A creative's work as Video, Audio and Kretopia credits, each a carousel (swipe, arrow keys, buttons on larger screens,
 * position dots). Which section something belongs to, and what counts as its proof, is decided in
 * `lib/passport/showcase.ts`. Sections with nothing in them are not drawn, covers load lazily, and no media element
 * exists until the player is opened.
 */
export function PassportShowcase<P extends ShowcasePiece>({ pieces, credits, onOpenMedia, onOpenCredit, className }: PassportShowcaseProps<P>) {
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
                {item.kind === "project" ? (
                  <ProjectCard item={item} onOpen={onOpenCredit && item.source === "credit" ? () => onOpenCredit(item) : undefined} />
                ) : (
                  <MediaCard item={item} onOpen={onOpenMedia} />
                )}
              </GlassCarouselItem>
            ))}
          </GlassCarousel>
        </section>
      ))}
    </div>
  );
}

export default PassportShowcase;
