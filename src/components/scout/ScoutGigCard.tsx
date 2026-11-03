import { Children, Fragment, isValidElement, useState, type MouseEvent, type ReactNode } from "react";
import { Banknote, Bookmark, Eye, MapPin, Zap } from "lucide-react";
import { KretoScene } from "@/components/brand/KretoScene";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { CardActionButton, CardIconButton, CardPill, CardShell, CardTextButton } from "@/components/cards/CardShell";
import { CARD_LABEL } from "@/components/cards/cardTokens";
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

/** The small rounded labels on the cover and in the tags. */
export const ScoutPill = CardPill;

/** The bookmark on the cover. Pressed means saved. */
export function ScoutSaveButton({ saved, label, onToggle }: { saved: boolean; label: string; onToggle: (event: MouseEvent) => void }) {
  return <CardIconButton action={{ icon: <Bookmark className={cn("h-[15px] w-[15px]", saved && "fill-current")} aria-hidden />, label, pressed: saved, onClick: onToggle }} />;
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
  /** After the pay chip, which always comes first. Three tags are drawn in all; the rest stay on the listing. */
  tags?: ReactNode;
  /** Two lines on the front: what the listing says it needs, and what it does not say. */
  evidence?: ReactNode;
  /** What the listing is and who stands behind it. Two lines, always on the front. */
  trust?: ReactNode;
  /** Anything else about the listing (other places a job is posted, for one): on the back, never the front. */
  children?: ReactNode;
  /** Icon-only controls over the cover, beside Save (open the source, dismiss). */
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

type BackMode = "look" | "apply";

/** Surfaces pass tags as a fragment of pills; the shell counts them one by one. */
function flattenTags(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) => (isValidElement(child) && child.type === Fragment ? flattenTags((child.props as { children?: ReactNode }).children) : [child]));
}

/**
 * The Scout card, on every surface (For You, All sources, the shortlist, the marketplace feed): the opportunity variant of CardShell.
 *
 * Front: the role's Kretopia illustration with where the listing comes from, the headline, company and place, what it says it needs (and does
 * not say), pay and tags, what the listing is, and one action. Back (Quick look): the listing's own brief and the fields it really has, or
 * Kreto drafting an application, all in place. Which parts a surface fills in is up to that surface: this component maps them onto the
 * shell's slots and never invents a field a listing does not have.
 */
export function ScoutGigCard({ title, company, art, href, onOpen, pills, save, pay, location, tags, evidence, trust, children, utility, apply, brief, details = [], opportunity, onQuickLook, draft, testId }: ScoutGigCardProps) {
  const { scene } = roleArtFor(art);
  const [mode, setMode] = useState<BackMode>("look");

  const open = onOpen ? { onClick: onOpen, ariaLabel: `View brief for ${title}` } : href?.startsWith("/") ? { to: href } : href ? { href } : undefined;
  const meta = (
    <>
      {company ? <>{company} · </> : null}
      <MapPin className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
      {location ? location : "Not listed"}
    </>
  );

  return (
    <CardShell
      testId={testId}
      title={title}
      open={open}
      cover={<KretoScene scene={scene} size="thumb" className="h-full w-full" />}
      coverStart={pills}
      coverControls={<>{utility}{save}</>}
      meta={meta}
      description={evidence}
      tags={[<ScoutPayChip key="pay" compensation={pay} />, ...flattenTags(tags)]}
      trust={trust}
      primary={apply}
      back={{
        label: mode === "apply" ? "apply with Kreto" : "quick look",
        eyebrow: mode === "apply" ? <><Zap className="h-3.5 w-3.5" aria-hidden />Apply with Kreto</> : <><Eye className="h-3.5 w-3.5" aria-hidden />Quick look</>,
        onOpen: () => {
          setMode("look");
          onQuickLook?.();
        },
        actions: (
          <>
            {mode === "apply" ? (
              <CardTextButton onClick={() => setMode("look")}><Eye className="h-3.5 w-3.5" aria-hidden />Brief</CardTextButton>
            ) : (
              <CardTextButton onClick={() => setMode("apply")} data-testid="apply-with-kreto-open"><Zap className="h-3.5 w-3.5" aria-hidden />Apply with Kreto</CardTextButton>
            )}
            <CardActionButton action={apply} />
          </>
        ),
        children:
          mode === "apply" ? (
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
                      <dt className={cn(CARD_LABEL, "mb-[5px]")}>{detail.label}</dt>
                      <dd className="m-0 text-xs leading-[1.55] text-foreground/85">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {children}
            </>
          ),
      }}
    />
  );
}
