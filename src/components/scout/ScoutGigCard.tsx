/* SCOUT_V4_STRUCTURE_MATCH */
/* SCOUT_FRONT_RESTRUCTURED */
import {
  useEffect, useId, useRef, useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties, type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, MapPin } from "lucide-react";
import { BookmarkButton } from "@/components/opportunity/BookmarkButton";
import { EasyApplyButton } from "@/components/opportunity/EasyApplyButton";
import { hasRealCompensation } from "@/lib/scoutPay";
import "./ScoutGigCard.hybrid.css";

export function ScoutPayChip({
  compensation,
}: {
  compensation?: string | null;
}) {
  return hasRealCompensation(compensation) ? (
    <span className="pay">{compensation}</span>
  ) : (
    <span className="pay missing">Pay not listed</span>
  );
}

type Props = {
  title: string;
  image?: string | null;
  href?: string;
  onOpen?: () => void;
  badges?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  pay?: string | null;
  testId?: string;
  company?: string | null;
  location?: string | null;
  workMode?: string;
  origin?: "external" | "kretopia";
  sourceName?: string | null;
  excerpt?: string | null;
  evidence?: ReactNode;
  internalOpportunityId?: string;
  familyLabel?: string;
};

export function ScoutGigCard({
  title, image, href, onOpen, badges, children,
  footer, pay, testId, company, location, workMode,
  origin, sourceName, excerpt, evidence, internalOpportunityId, familyLabel,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [broken, setBroken] = useState(false);

  const tiltRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);
  const backId = useId();

  useEffect(() => {
    setFlipped(false);
    setBroken(false);
  }, [image, href, title]);

  useEffect(() => {
    frontRef.current?.toggleAttribute("inert", flipped);
    backRef.current?.toggleAttribute("inert", !flipped);

    if (initialized.current) {
      (flipped ? returnRef.current : quickRef.current)
        ?.focus({ preventScroll: true });
    }
    initialized.current = true;
  }, [flipped]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.max(0, Math.min(1,
      (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1,
      (event.clientY - rect.top) / rect.height));

    event.currentTarget.style.setProperty("--mx", `${x * 100}%`);
    event.currentTarget.style.setProperty("--my", `${y * 100}%`);

    if (tiltRef.current) {
      tiltRef.current.style.transform =
        `rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 10}deg)`;
    }
  };

  const resetTilt = () => {
    if (tiltRef.current) {
      tiltRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && flipped) {
      event.stopPropagation();
      setFlipped(false);
    }
  };

  const openDetail = (label: string) => {
    const content = (
      <>
        {label}
        <ArrowRight size={14} aria-hidden="true" />
      </>
    );

    if (onOpen) {
      return (
        <button className="btn primary" type="button" onClick={onOpen}>
          {content}
        </button>
      );
    }

    if (href?.startsWith("/")) {
      return <Link className="btn primary" to={href}>{content}</Link>;
    }

    if (href) {
      return (
        <a className="btn primary" href={href}
          target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }

    return null;
  };

  const titleAction = onOpen ? (
    <button type="button" onClick={onOpen}>{title}</button>
  ) : href?.startsWith("/") ? (
    <Link to={href}>{title}</Link>
  ) : href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{title}</a>
  ) : title;

  const place = [location, workMode].filter(Boolean).join(" · ");

  // SCOUT_COMPACT_SAFE_V3
  const isCollaboration =
    /\b(collab|collaboration|co-creation|co-production)\b/i.test(title);

  const explicitlyUnpaid =
    /\b(unpaid|volunteer|voluntary|pro bono|non-remunerated)\b/i
      .test(`${title} ${pay ?? ""}`);

  const paid = hasRealCompensation(pay);

  const compactStatus = explicitlyUnpaid
    ? (isCollaboration ? "Unpaid collaboration" : "Unpaid")
    : isCollaboration
      ? (paid ? "Paid collaboration" : "Collaboration")
      : paid
        ? "Paid opportunity"
        : "Pay not listed";


  const material = (
    <>
      <div className="material" aria-hidden="true" />
      <div className="foil-light" aria-hidden="true" />
      <div className="prismatic-edge" aria-hidden="true" />
    </>
  );

  return (
    <div className="scout-v4" data-testid={testId}>
      <div className="scene">
        <div className="holo"
          onPointerMove={onPointerMove}
          onPointerLeave={resetTilt}
        >
          <div className="tilt-shell" ref={tiltRef}>
            <article
              className={`flip-card${flipped ? " is-flipped" : ""}`}
              aria-label={title}
              onKeyDown={onKeyDown}
            >
              <div className="flip-inner">
                <div
                  ref={frontRef}
                  className="flip-face flip-front"
                  aria-hidden={flipped}
                >
                  <div className="cover">
                    {image && !broken ? (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setBroken(true)}
                      />
                    ) : (
                      <div className="scout-v4__fallback" aria-hidden="true"
                        style={{
                          "--scout-fallback": [
                            "#4012F8", "#A516C5", "#F62489", "#FFA722"
                          ][Array.from(familyLabel || title)
                            .reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4],
                        } as CSSProperties}>
                        <span className="scout-v4__fallback-label">{familyLabel || "SCOUT"}</span>
                        <span className="scout-v4__fallback-source">
                          {sourceName || (origin === "kretopia"
                            ? "Kretopia opportunity"
                            : "Creative opportunity")}
                        </span>
                      </div>
                    )}

                    <div className="cover-top">
                      <div className="origin">
                        {origin === "kretopia" && (
                          <span className="pill internal">Kretopia</span>
                        )}
                        {origin === "external" && (
                          <span className="pill type">External source</span>
                        )}
                        {badges}
                      </div>

                      {internalOpportunityId && (
                        <BookmarkButton
                          opportunityId={internalOpportunityId}
                          variant="ghost"
                          size="icon"
                          className="save"
                        />
                      )}
                    </div>
                  </div>

                  <div className="content">
                    <div className="headline">
                      <h4>{titleAction}</h4>
                      <span className="scout-v4__compact-status">
                        {compactStatus}
                      </span>
                      {company && (
                        <p className="organisation">{company}</p>
                      )}
                    </div>

                    <dl className="facts">
                      {place && (
                        <div className="fact">
                          <dt>Location</dt>
                          <dd>
                            <MapPin size={13} aria-hidden="true" />
                            {place}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <footer className="card-foot">
                      <button
                        type="button"
                        className="card-action"
                        ref={quickRef}
                        aria-controls={backId}
                        aria-expanded={flipped}
                        onClick={() => setFlipped(true)}
                      >
                        <Eye size={14} aria-hidden="true" />
                        Quick look
                      </button>

                      <div className="apply-actions">
                        {internalOpportunityId && (
                          <EasyApplyButton
                            opportunityId={internalOpportunityId}
                            opportunityTitle={title}
                          />
                        )}

                      </div>
                    </footer>
                  </div>
                  {material}
                </div>

                <div
                  id={backId}
                  ref={backRef}
                  className="flip-face flip-back"
                  aria-hidden={!flipped}
                >
                  <div className="content">
                    <p className="back-label">
                      <Eye size={14} aria-hidden="true" />
                      Quick preview
                    </p>

                    <div className="headline">
                      <h4>{title}</h4>
                      {company && (
                        <p className="organisation">{company}</p>
                      )}
                    </div>

                    {excerpt && (
                      <p className="description">{excerpt}</p>
                    )}

                    <div className="detail-list">
                      <div className="detail-item">
                        <span>Budget</span>
                        <p><ScoutPayChip compensation={pay} /></p>
                      </div>

                      {place && (
                        <div className="detail-item">
                          <span>Location</span>
                          <p>{place}</p>
                        </div>
                      )}

                      {sourceName && (
                        <div className="detail-item">
                          <span>Source</span>
                          <p>{sourceName}</p>
                        </div>
                      )}
                    </div>

                    {evidence && (
                      <div className="evidence">
                        <p className="evidence-label">Relevant evidence</p>
                        <div className="evidence-copy">{evidence}</div>
                      </div>
                    )}

                    {/* Additional listing information — Quick look */}
                    {children && (
                      <div className="scout-v4__quick-details">
                        {children}
                      </div>
                    )}

                    {/* SCOUT_ACTIONS_ON_QUICKLOOK_V9 */}
                    {footer && (
                      <div
                        className="scout-v4__quick-details"
                        aria-label="Opportunity source and actions"
                      >
                        {footer}
                      </div>
                    )}

                    <footer className="card-foot">
                      <button
                        ref={returnRef}
                        type="button"
                        className="card-action"
                        onClick={() => setFlipped(false)}
                      >
                        <ArrowLeft size={14} aria-hidden="true" />
                        Flip back
                      </button>

                      <div className="apply-actions">
                        {openDetail("View full brief")}
                      </div>
                    </footer>
                  </div>
                  {material}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
