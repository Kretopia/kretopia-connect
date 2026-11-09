import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface EventAboutSectionProps {
  description?: string | null;
  program: ReactNode;
  venue: ReactNode;
  policies: ReactNode;
  faq: ReactNode;
}

export function EventAboutSection({ description, program, venue, policies, faq }: EventAboutSectionProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph) return;

    const measure = () => {
      if (expanded) {
        setCanExpand(true);
        return;
      }
      setCanExpand(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(paragraph);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [description, expanded]);

  return (
    <section id="about" aria-labelledby="event-about-heading" className="space-y-6 rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="space-y-4">
          <h2 id="event-about-heading" className="text-xl font-semibold">About</h2>
          {description ? (
            <>
              <p
                ref={paragraphRef}
                className={`whitespace-pre-wrap text-muted-foreground ${expanded ? "" : "line-clamp-2 md:line-clamp-3"}`}
              >
                {description}
              </p>
              {(canExpand || expanded) && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {expanded ? "Read less" : "Read more"}
                </button>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">The host hasn't added an event description yet.</p>
          )}
        </div>
        <section id="about-program" aria-labelledby="event-program-heading" className="space-y-2 border-t border-border pt-4">
          <h3 id="event-program-heading" className="font-semibold">Program</h3>
          {program}
        </section>
        <section id="about-venue" aria-labelledby="event-venue-heading" className="space-y-2 border-t border-border pt-4">
          <h3 id="event-venue-heading" className="font-semibold">Venue</h3>
          {venue}
        </section>
        <section id="about-policies" aria-labelledby="event-policies-heading" className="space-y-2 border-t border-border pt-4">
          <h3 id="event-policies-heading" className="font-semibold">Policies</h3>
          {policies}
        </section>
        <section id="about-faq" aria-labelledby="event-faq-heading" className="space-y-4 border-t border-border pt-4">
          <h3 id="event-faq-heading" className="font-semibold">FAQ</h3>
          {faq}
        </section>
    </section>
  );
}
