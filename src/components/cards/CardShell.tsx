import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ExternalLink, RotateCcw } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import { cn } from "@/lib/utils";
import {
  CARD_ABOVE, CARD_BACK_LABEL, CARD_BODY, CARD_BODY_BACK, CARD_BTN, CARD_BTN_PRIMARY, CARD_BTN_PRIMARY_STYLE, CARD_BUDGET, CARD_COVER, CARD_COVER_OVERLAY,
  CARD_COVER_SCRIM, CARD_DESCRIPTION, CARD_FACE, CARD_FACE_BACK, CARD_FACE_STYLE, CARD_FLIP_INNER, CARD_FLIP_OUTER, CARD_FOOTER, CARD_ICON_BTN,
  CARD_ICON_BTN_ON, CARD_META, CARD_PILL, CARD_PILL_TONE, CARD_STRETCH, CARD_TAGS, CARD_TEXT_ACTION, CARD_TITLE, CARD_TRUST, clampClass,
  type CardPillTone,
} from "./cardTokens";

/** Where something goes: in the app (`to`), to another site in a new tab (`href`), or to the caller (`onClick`). */
export interface CardTarget {
  to?: string;
  href?: string;
  rel?: string;
  onClick?: (event: MouseEvent) => void;
  ariaLabel?: string;
  /** A button that is waiting for an answer cannot be pressed again. */
  disabled?: boolean;
}

/** The card's one primary action. */
export interface CardAction extends CardTarget {
  label: string;
  testId?: string;
}

/** The card's one secondary action: an icon, always with the name a screen reader reads. */
export interface CardIconAction extends CardTarget {
  icon: ReactNode;
  label: string;
  testId?: string;
  pressed?: boolean;
  /** Words for assistive technology only, when the control's text is part of what a screen reader and a test should find. */
  srText?: string;
}

/** The turned side of a card. It is only built once the card is first flipped, so a long list stays light. */
export interface CardBack {
  /** What a screen reader hears for the back face, after the title. */
  label: string;
  /** The small label above the title on the back. */
  eyebrow: ReactNode;
  children: ReactNode;
  /** Beside "Flip back" in the back's footer. */
  actions?: ReactNode;
  /** Called each time the back is opened. */
  onOpen?: () => void;
}

export interface CardShellProps {
  testId?: string;
  title: string;
  /** Where the title goes. With `stretch`, the whole card is that target. */
  open?: CardTarget;
  stretch?: boolean;
  /** The picture. The shell gives it a fixed 16:9 box, whatever it holds. */
  cover: ReactNode;
  /** Top left of the cover: where the thing comes from, what kind it is. */
  coverStart?: ReactNode;
  /** Top right of the cover: icon-only controls (save, open the source, dismiss). They are over the picture, not footer actions. */
  coverControls?: ReactNode;
  /** One line, cut off with an ellipsis. */
  meta?: ReactNode;
  /** Two lines at most; the rest stays on the detail view. */
  description?: ReactNode;
  /** Three at most; the rest are not drawn. */
  tags?: ReactNode[];
  /** What this is and who stands behind it (an outside listing says so here). Two lines at most, always on the front. */
  trust?: ReactNode;
  primary?: CardAction;
  /** Ignored when the card has a `back`: the secondary action is then the one that turns it. */
  secondary?: CardIconAction;
  back?: CardBack;
  className?: string;
}

/** The small rounded labels on the cover and in the tags. */
export function CardPill({ tone = "plain", className, children }: { tone?: CardPillTone; className?: string; children: ReactNode }) {
  return <span className={cn(CARD_PILL, CARD_PILL_TONE[tone], className)}>{children}</span>;
}

function Target({ target, className, style, children, testId, title, pressed, part }: { target: CardTarget; className?: string; style?: CSSProperties; children: ReactNode; testId?: string; title?: string; pressed?: boolean; part?: string }) {
  const common = { className, style, "aria-label": target.ariaLabel, "data-testid": testId, "data-card-part": part, title };
  if (target.to) return <Link to={target.to} onClick={target.onClick} {...common}>{children}</Link>;
  if (target.href) return <a href={target.href} target="_blank" rel={target.rel ?? "noopener noreferrer"} onClick={target.onClick} {...common}>{children}</a>;
  return <button type="button" onClick={target.onClick} aria-pressed={pressed} disabled={target.disabled} {...common}>{children}</button>;
}

/** The primary action: a link in the app, a new-tab link to another site, or a button. */
export function CardActionButton({ action, className }: { action: CardAction; className?: string }) {
  return (
    <Target target={action} testId={action.testId} part="primary" className={cn(CARD_BTN, CARD_BTN_PRIMARY, className)} style={CARD_BTN_PRIMARY_STYLE}>
      {action.label}
      {action.href ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
    </Target>
  );
}

/** An icon-only control: 44px, named for assistive technology, pressed when `pressed`. */
export function CardIconButton({ action, className, part = "icon-action" }: { action: CardIconAction; className?: string; part?: string }) {
  return (
    <Target
      target={{ ...action, ariaLabel: action.ariaLabel ?? action.label }}
      testId={action.testId}
      title={action.label}
      pressed={action.pressed}
      part={part}
      className={cn(CARD_ICON_BTN, action.pressed && CARD_ICON_BTN_ON, className)}
    >
      {action.icon}
      {action.srText ? <span className="sr-only">{action.srText}</span> : null}
    </Target>
  );
}

/** A secondary button for a card's back, where there is room for a word. */
export function CardTextButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn(CARD_BTN, className)} {...props} />;
}

/**
 * The one card of Kretopia. A fixed 16:9 cover with a couple of overlays, a title (two lines), one line of meta, a description (two lines),
 * up to three tags, and a footer with one primary action and at most one secondary icon action. Nothing a surface passes can make it grow:
 * the budget is applied here, not asked of the caller. The tilt, the foil, the radius, the elevation and the flip come with it.
 *
 * Long text, extra fields and anything else a surface wants to show belong on the back (`back`) or on the detail view, never on the front.
 */
export function CardShell({ testId, title, open, stretch = false, cover, coverStart, coverControls, meta, description, tags, trust, primary, secondary, back, className }: CardShellProps) {
  const backId = useId();
  const [flipped, setFlipped] = useState(false);
  const [backBuilt, setBackBuilt] = useState(false);
  const front = useRef<HTMLDivElement>(null);
  const backFace = useRef<HTMLDivElement>(null);
  const flipButton = useRef<HTMLButtonElement>(null);
  const flipBackButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const flipTo = (on: boolean) => {
    moved.current = true;
    if (on) {
      setBackBuilt(true);
      back?.onOpen?.();
    }
    setFlipped(on);
  };

  // The face that is turned away is inert (no focus, no clicks), and focus follows the flip.
  useEffect(() => {
    front.current?.toggleAttribute("inert", flipped);
    backFace.current?.toggleAttribute("inert", !flipped);
    if (moved.current) (flipped ? flipBackButton : flipButton).current?.focus({ preventScroll: true });
  }, [flipped, backBuilt]);

  const titleClass = cn("block", CARD_TITLE, clampClass(CARD_BUDGET.titleLines), stretch && CARD_STRETCH);
  const heading = open && (open.to || open.href || open.onClick)
    ? <Target target={open} part="title" className={cn(titleClass, open.onClick && !open.to && !open.href && "w-full")}><span>{title}</span></Target>
    : <span data-card-part="title" className={titleClass}>{title}</span>;

  const shownTags = (tags ?? []).filter(Boolean).slice(0, CARD_BUDGET.tags);
  const trigger = back ? (
    <button
      ref={flipButton}
      type="button"
      className={cn(CARD_ICON_BTN, CARD_ABOVE)}
      data-card-part="secondary"
      aria-controls={backId}
      aria-expanded={flipped}
      aria-label="Quick look"
      title="Quick look"
      onClick={() => flipTo(true)}
      data-testid="quick-look"
    >
      <Eye className="h-[15px] w-[15px]" aria-hidden />
    </button>
  ) : secondary ? (
    <CardIconButton action={secondary} className={CARD_ABOVE} part="secondary" />
  ) : null;

  return (
    <HoloCard className={cn("h-full", className)} glow={false}>
      <article
        data-testid={testId}
        data-flipped={flipped ? "true" : "false"}
        className={CARD_FLIP_OUTER}
        onKeyDown={(event) => {
          if (event.key === "Escape" && flipped) {
            event.stopPropagation();
            flipTo(false);
          }
        }}
      >
        <div className={CARD_FLIP_INNER} style={{ transform: flipped ? "rotateY(180deg)" : undefined }}>
          {/* FRONT */}
          <div ref={front} className={CARD_FACE} style={CARD_FACE_STYLE} aria-hidden={flipped || undefined}>
            <div className={CARD_COVER} data-card-part="cover">
              {cover}
              <div className={CARD_COVER_SCRIM} />
              <div className={CARD_COVER_OVERLAY}>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">{coverStart}</div>
                <div className={cn("flex shrink-0 items-start gap-1.5", CARD_ABOVE)}>{coverControls}</div>
              </div>
            </div>
            <div className={CARD_BODY}>
              <div>
                {heading}
                {meta ? <p data-card-part="meta" className={cn("mt-1.5", CARD_META)}>{meta}</p> : null}
              </div>
              {description ? <div data-card-part="description" className={cn(CARD_DESCRIPTION, clampClass(CARD_BUDGET.descriptionLines))}>{description}</div> : null}
              {shownTags.length > 0 ? <div data-card-part="tags" className={CARD_TAGS}>{shownTags}</div> : null}
              {trust ? <div data-card-part="trust" className={cn(CARD_TRUST, clampClass(CARD_BUDGET.trustLines))}>{trust}</div> : null}
              {trigger || primary ? (
                <footer data-card-part="footer" className={CARD_FOOTER}>
                  <div className="flex items-center gap-1.5">{trigger}</div>
                  {primary ? <CardActionButton action={primary} className={CARD_ABOVE} /> : null}
                </footer>
              ) : null}
            </div>
          </div>

          {/* BACK: built the first time the card is flipped */}
          {back && backBuilt ? (
            <div
              ref={backFace}
              id={backId}
              className={cn(CARD_FACE, CARD_FACE_BACK)}
              style={{ ...CARD_FACE_STYLE, transform: "rotateY(180deg)" }}
              aria-hidden={!flipped}
              aria-label={`${title}: ${back.label}`}
              role="group"
            >
              <div className={CARD_BODY_BACK}>
                <p className={CARD_BACK_LABEL}>{back.eyebrow}</p>
                <div>
                  <h4 className={cn(CARD_TITLE, "block")}>{title}</h4>
                  {meta ? <p className={cn("mt-1.5", CARD_META)}>{meta}</p> : null}
                </div>
                {back.children}
                <footer className={CARD_FOOTER}>
                  <button ref={flipBackButton} type="button" className={CARD_TEXT_ACTION} onClick={() => flipTo(false)} data-testid="flip-back">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />Flip back
                  </button>
                  <div className="flex flex-wrap items-center justify-end gap-2">{back.actions}</div>
                </footer>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </HoloCard>
  );
}
