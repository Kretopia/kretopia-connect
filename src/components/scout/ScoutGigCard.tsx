import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, Bookmark, ExternalLink, Eye, MapPin, RotateCcw, Zap } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { BRAND_GRADIENT } from "@/components/nav/bottomNavMetrics";
import { hasRealCompensation } from "@/lib/scoutPay";
import { roleArtFor, type RoleArtInput } from "@/lib/scoutRoleArt";
import type { OpportunityFacts } from "@/lib/kretoDraft";
import { cn } from "@/lib/utils";
import { ApplyWithKreto } from "./ApplyWithKreto";

export function ScoutPayChip({ compensation }: { compensation?: string | null }) {
  return hasRealCompensation(compensation) ? (
    <span title={compensation ?? undefined} className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-[7px] py-[3px] text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
      <Banknote className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{compensation}</span>
    </span>
  ) : <span className="rounded-full border border-dashed border-border px-[7px] py-[3px] text-[11px] font-medium text-muted-foreground">Pay not listed</span>;
}

type PillTone = "origin" | "type" | "plain";
const PILL_TONE: Record<PillTone, string> = {
  origin: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  type: "border-border bg-background/75 font-medium text-foreground/80 backdrop-blur-sm",
  plain: "border-border bg-muted/50 text-muted-foreground",
};

/** The small rounded labels on the cover and in the tags. */
export function ScoutPill({ tone = "plain", className, children }: { tone?: PillTone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-[5px] rounded-full border px-2 py-[5px] text-[10px] font-bold leading-[1.2] tracking-[0.025em]", PILL_TONE[tone], className)}>{children}</span>;
}

/** The bookmark on the cover. Pressed means saved. */
export function ScoutSaveButton({ saved, label, onToggle }: { saved: boolean; label: string; onToggle: (event: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Saved" : "Save"}
      onClick={onToggle}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        saved ? "border-energy/50 bg-energy/15 text-energy" : "border-border bg-background/70 text-foreground/80 hover:text-foreground",
      )}
    >
      <Bookmark className={cn("h-[15px] w-[15px]", saved && "fill-current")} aria-hidden />
    </button>
  );
}

export interface ScoutCardApply {
  label: string;
  /** In-app address. */
  to?: string;
  /** Another site: opens in a new tab. */
  href?: string;
  rel?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export interface ScoutCardDetail {
  label: string;
  value: ReactNode;
}

/** Keeps the fields a listing really has: a missing one is `false`, `null` or empty in the list and is dropped, never printed as a blank. */
export function compactDetails(items: Array<ScoutCardDetail | false | "" | null | undefined>): ScoutCardDetail[] {
  return items.filter((item): item is ScoutCardDetail => Boolean(item));
}

export interface ScoutGigCardProps {
  title: string;
  company?: string | null;
  /** What the cover illustration is chosen from: the listing's family when known, its title otherwise. */
  art: RoleArtInput;
  /** Where the title goes: an in-app path, another site, or (onOpen) the caller's own detail view. */
  href?: string;
  onOpen?: () => void;
  /** Top left of the cover: where the listing comes from, and what kind it is. */
  pills?: ReactNode;
  /** Top right of the cover. */
  save?: ReactNode;
  pay?: string | null;
  location?: ReactNode;
  tags?: ReactNode;
  evidence?: ReactNode;
  trust?: ReactNode;
  /** Anything else the front carries (other places a job is posted, for one). */
  children?: ReactNode;
  /** Icon buttons beside "Quick look" (open the source, dismiss). */
  utility?: ReactNode;
  /** What "Apply" does for this source. */
  apply: ScoutCardApply;
  /** The listing's own text, shown on the back of the card without leaving Kretopia. */
  brief: { text?: string | null; node?: ReactNode; loading?: boolean; originalUrl?: string | null };
  /** The fields the listing really has, and no others. */
  details?: ScoutCardDetail[];
  /** What Kreto is given to draft an application from. */
  opportunity: OpportunityFacts;
  /** Called each time the back is opened, so a caller can fetch the full text. */
  onQuickLook?: () => void;
  /** When the caller keeps the draft (so it follows the person to a fuller apply flow). */
  draft?: { value: string; onChange: (next: string) => void };
  testId?: string;
}

const BTN =
  "relative inline-flex min-h-[34px] items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-border bg-muted/40 px-3 text-[11px] font-bold leading-[1.3] text-foreground " +
  "transition duration-150 hover:-translate-y-px hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0";
// The primary button: a card-coloured fill inside the brand gradient's border.
const BTN_PRIMARY = "border-transparent shadow-[0_0_16px_hsl(330_93%_55%/0.13)] hover:shadow-[0_0_22px_hsl(330_93%_55%/0.24)]";
const BTN_PRIMARY_STYLE = { background: `linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, ${BRAND_GRADIENT} border-box` };
const CARD_ACTION = "inline-flex min-h-[34px] items-center gap-[5px] rounded-md px-1 py-1.5 text-[11px] font-bold text-energy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap";
const FACE = "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card [grid-area:1/1]";
const FACE_STYLE = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
const LABEL = "text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground";

function ApplyButton({ apply, className }: { apply: ScoutCardApply; className?: string }) {
  const cls = cn(BTN, BTN_PRIMARY, className);
  const content = (
    <>
      {apply.label}
      {apply.href ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
    </>
  );
  if (apply.to) return <Link to={apply.to} className={cls} style={BTN_PRIMARY_STYLE} aria-label={apply.ariaLabel} onClick={apply.onClick}>{content}</Link>;
  if (apply.href) return <a href={apply.href} target="_blank" rel={apply.rel ?? "noopener noreferrer"} className={cls} style={BTN_PRIMARY_STYLE} aria-label={apply.ariaLabel} onClick={apply.onClick}>{content}</a>;
  return <button type="button" className={cls} style={BTN_PRIMARY_STYLE} aria-label={apply.ariaLabel} onClick={apply.onClick}>{content}</button>;
}

type BackMode = "look" | "apply";

/**
 * The one Scout card, on every surface (For You, All sources, the shortlist, the marketplace feed): a Hybrid card in the Holo shell.
 *
 * Front: the role's Kretopia illustration with where the listing comes from, the headline, pay and place, tags, evidence, trust, and the
 * actions. Back (flip): the listing's own brief and the fields it really has, or Kreto drafting an application, all in place; the back
 * is only built once a card is first flipped, so a long list stays light. Which parts a surface fills in is up to that surface: this
 * component owns the anatomy, the look and the flip, and never invents a field a listing does not have.
 */
export function ScoutGigCard({ title, company, art, href, onOpen, pills, save, pay, location, tags, evidence, trust, children, utility, apply, brief, details = [], opportunity, onQuickLook, draft, testId }: ScoutGigCardProps) {
  const { scene } = roleArtFor(art);
  const backId = useId();
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<BackMode>("look");
  const [backBuilt, setBackBuilt] = useState(false);
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const quickLookButton = useRef<HTMLButtonElement>(null);
  const flipBackButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const flipTo = (on: boolean, next: BackMode = "look") => {
    moved.current = true;
    if (on) {
      setBackBuilt(true);
      setMode(next);
      onQuickLook?.();
    }
    setFlipped(on);
  };

  // The face that is turned away is inert (no focus, no clicks), and focus follows the flip.
  useEffect(() => {
    front.current?.toggleAttribute("inert", flipped);
    back.current?.toggleAttribute("inert", !flipped);
    if (moved.current) (flipped ? flipBackButton : quickLookButton).current?.focus({ preventScroll: true });
  }, [flipped, backBuilt]);

  const titleClass = "block text-left text-[21px] font-bold leading-[1.28] tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] line-clamp-3";
  const heading = onOpen ? (
    <button type="button" className={cn(titleClass, "w-full")} onClick={onOpen} aria-label={`View brief for ${title}`}><span>{title}</span></button>
  ) : href?.startsWith("/") ? (
    <Link to={href} className={titleClass}>{title}</Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={titleClass}>{title}</a>
  ) : (
    <span className={titleClass}>{title}</span>
  );

  const place = [company, typeof location === "string" ? location : null].filter(Boolean).join(" · ");

  const footerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {mode === "apply" && flipped ? (
        <button type="button" className={BTN} onClick={() => setMode("look")}>
          <Eye className="h-3.5 w-3.5" aria-hidden />Brief
        </button>
      ) : (
        <button type="button" className={BTN} onClick={() => flipTo(true, "apply")} data-testid="apply-with-kreto-open">
          <Zap className="h-3.5 w-3.5" aria-hidden />Apply with Kreto
        </button>
      )}
      <ApplyButton apply={apply} />
    </div>
  );

  return (
    <HoloCard className="h-full" glow={false}>
      <article
        data-testid={testId}
        data-flipped={flipped ? "true" : "false"}
        className="h-full [perspective:1300px]"
        onKeyDown={(event) => {
          if (event.key === "Escape" && flipped) {
            event.stopPropagation();
            flipTo(false);
          }
        }}
      >
        <div
          className="grid h-full [transform-style:preserve-3d] transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] motion-reduce:transition-none"
          style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
        >
          {/* FRONT */}
          <div ref={front} className={FACE} style={FACE_STYLE} aria-hidden={flipped || undefined}>
            <div className="relative aspect-[16/9] shrink-0 overflow-hidden">
              <KretoScene scene={scene} size="thumb" className="h-full w-full" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-card/60" />
              <div className="absolute inset-x-[15px] top-[15px] z-[2] flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">{pills}</div>
                {save}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[13px] p-5 max-[420px]:p-4">
              <div>
                {heading}
                {company ? <p className="mt-1.5 text-xs leading-normal text-muted-foreground">{company}</p> : null}
              </div>
              <dl className="grid grid-cols-2 gap-2.5">
                <div className="min-w-0">
                  <dt className={cn(LABEL, "mb-1")}>Budget</dt>
                  <dd className="m-0 flex flex-wrap items-center gap-[5px] text-xs"><ScoutPayChip compensation={pay} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className={cn(LABEL, "mb-1")}>Location</dt>
                  <dd className="m-0 flex flex-wrap items-center gap-[5px] text-xs leading-normal">
                    {location ? <><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{location}</> : <span className="text-muted-foreground">Not listed</span>}
                  </dd>
                </div>
              </dl>
              {tags ? <div className="flex flex-wrap gap-1.5">{tags}</div> : null}
              {evidence}
              {trust}
              {children}
              <footer className="mt-auto flex flex-wrap items-center justify-between gap-[9px] border-t border-border pt-[13px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    ref={quickLookButton}
                    type="button"
                    className={CARD_ACTION}
                    aria-controls={backId}
                    aria-expanded={flipped}
                    onClick={() => flipTo(true, "look")}
                    data-testid="quick-look"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />Quick look
                  </button>
                  {utility}
                </div>
                {footerActions}
              </footer>
            </div>
          </div>

          {/* BACK: built the first time the card is flipped */}
          {backBuilt ? (
            <div
              ref={back}
              id={backId}
              className={cn(FACE, "bg-[linear-gradient(138deg,hsl(var(--primary)/0.10),hsl(var(--card))_65%)]")}
              style={{ ...FACE_STYLE, transform: "rotateY(180deg)" }}
              aria-hidden={!flipped}
              aria-label={`${title}: ${mode === "apply" ? "apply with Kreto" : "quick look"}`}
              role="group"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-[18px] p-6 max-[420px]:p-[19px]">
                <p className="flex items-center gap-[7px] text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">
                  {mode === "apply" ? <Zap className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                  {mode === "apply" ? "Apply with Kreto" : "Quick look"}
                </p>
                <div>
                  <h4 className="text-[21px] font-bold leading-[1.28] tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] max-[420px]:text-[19px]">{title}</h4>
                  {place ? <p className="mt-1.5 text-xs text-muted-foreground">{place}</p> : null}
                </div>

                {mode === "apply" ? (
                  <ApplyWithKreto opportunity={opportunity} value={draft?.value} onChange={draft?.onChange} />
                ) : (
                  <>
                    <section aria-label="Brief" tabIndex={0} className="max-h-[18rem] overflow-y-auto pr-1 text-[13px] leading-[1.7] text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="quick-look-brief">
                      {brief.loading ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground"><KretopiaSpinner className="h-3.5 w-3.5" />Loading the full listing…</p>
                      ) : brief.node ? (
                        brief.node
                      ) : brief.text?.trim() ? (
                        brief.text.trim().split(/\n{2,}/).map((paragraph, index) => <p key={index} className={cn(index > 0 && "mt-2.5", "whitespace-pre-line")}>{paragraph}</p>)
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          This listing did not include a description.
                          {brief.originalUrl ? <> <a href={brief.originalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">Read the original listing</a>.</> : null}
                        </p>
                      )}
                    </section>
                    {details.length > 0 ? (
                      <dl className="grid gap-3.5">
                        {details.map((detail) => (
                          <div key={detail.label}>
                            <dt className={cn(LABEL, "mb-[5px]")}>{detail.label}</dt>
                            <dd className="m-0 text-xs leading-[1.55] text-foreground/85">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {evidence}
                  </>
                )}

                <footer className="mt-auto flex flex-wrap items-center justify-between gap-[9px] border-t border-border pt-[13px]">
                  <button ref={flipBackButton} type="button" className={CARD_ACTION} onClick={() => flipTo(false)} data-testid="flip-back">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />Flip back
                  </button>
                  {footerActions}
                </footer>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </HoloCard>
  );
}
