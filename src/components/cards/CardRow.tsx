import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CardActionButton, CardLink, type CardAction, type CardTarget } from "./CardShell";
import {
  CARD_ABOVE, CARD_BTN, CARD_DESCRIPTION, CARD_META, CARD_ROW, CARD_ROW_BUDGET, CARD_ROW_SELECTED, CARD_ROW_TITLE, CARD_STRETCH, CARD_TAGS, clampClass,
} from "./cardTokens";

export interface CardRowProps {
  testId?: string;
  title: string;
  /** Where the title goes. When there is one, the whole row is that target (a link in the app, a new-tab link, or a button). */
  open?: CardTarget;
  /** The row a map or a list has chosen: ringed, and announced as the current one. */
  selected?: boolean;
  /** An avatar, a thumbnail or an icon tile, at the start of the row. */
  lead?: ReactNode;
  /** Small labels above the title: what kind it is, where it stands. */
  eyebrow?: ReactNode;
  /** One line under the title, cut off with an ellipsis. */
  meta?: ReactNode;
  /** Two lines at most. */
  description?: ReactNode;
  /** Four at most; the rest are not drawn. */
  tags?: ReactNode[];
  /** One more bounded block (a trade offer, a note), drawn under the tags. */
  extra?: ReactNode;
  /** Icon-only controls on the trailing edge (save, share, a menu). They sit above the row's link, so pressing one never opens the row. */
  controls?: ReactNode;
  /** Decoration at the trailing edge (a chevron). It sits under the row's link, so pressing it opens the row. */
  trailing?: ReactNode;
  primary?: CardAction;
  secondary?: CardAction;
  /** A feature's own action component, in the primary's place, for an action that owns its own state or dialog. Ignored when `primary` is set. */
  action?: ReactNode;
  className?: string;
}

/**
 * The compact form of the shared card, for a list that cannot be tiles: the map's sidebar, ranked results, the people in a shortlist. It is the
 * card's frame (radius, border, fill), pills, buttons, and meta and description scale in one flat line instead of a cover, with the same rules:
 * the budget is applied here, the whole row is one real link or button when it has a target, and what must stay clickable sits above it.
 * It never tilts and never flips; what does not fit a row belongs on the detail view.
 */
export function CardRow({ testId, title, open, selected = false, lead, eyebrow, meta, description, tags, extra, controls, trailing, primary, secondary, action, className }: CardRowProps) {
  const target = open && (open.to || open.href || open.onClick) ? open : null;
  const titleClass = cn("block", CARD_ROW_TITLE, clampClass(CARD_ROW_BUDGET.titleLines));
  const shownTags = (tags ?? []).filter(Boolean).slice(0, CARD_ROW_BUDGET.tags);
  const hasActions = Boolean(primary || secondary || action);

  return (
    <article data-testid={testId} data-card-part="row" data-selected={selected ? "true" : undefined} className={cn(CARD_ROW, selected && CARD_ROW_SELECTED, className)}>
      {lead ? <div data-card-part="lead" className="shrink-0">{lead}</div> : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        {eyebrow ? <div data-card-part="eyebrow" className="flex min-w-0 flex-wrap items-center gap-1.5">{eyebrow}</div> : null}
        <div>
          {target ? (
            <CardLink target={target} part="title" current={selected} className={cn(titleClass, CARD_STRETCH, !target.to && !target.href && "w-full")}>
              <span>{title}</span>
            </CardLink>
          ) : (
            <span data-card-part="title" className={titleClass}>{title}</span>
          )}
          {meta ? <p data-card-part="meta" className={cn("mt-0.5", CARD_META)}>{meta}</p> : null}
        </div>
        {description ? <div data-card-part="description" className={cn(CARD_DESCRIPTION, clampClass(CARD_ROW_BUDGET.descriptionLines))}>{description}</div> : null}
        {shownTags.length > 0 ? <div data-card-part="tags" className={CARD_TAGS}>{shownTags}</div> : null}
        {extra ? <div data-card-part="extra" className="min-w-0">{extra}</div> : null}
        {hasActions ? (
          <div data-card-part="actions" className="flex flex-wrap items-center gap-2 pt-0.5">
            {secondary ? (
              <CardLink target={secondary} testId={secondary.testId} part="secondary" className={cn(CARD_BTN, CARD_ABOVE)}>{secondary.label}</CardLink>
            ) : null}
            {primary ? <CardActionButton action={primary} className={CARD_ABOVE} /> : action ? <div data-card-part="primary" className={CARD_ABOVE}>{action}</div> : null}
          </div>
        ) : null}
      </div>
      {controls ? <div data-card-part="controls" className={cn("flex shrink-0 items-center gap-1", CARD_ABOVE)}>{controls}</div> : null}
      {trailing ? <div data-card-part="trailing" className="shrink-0 self-center text-muted-foreground">{trailing}</div> : null}
    </article>
  );
}
