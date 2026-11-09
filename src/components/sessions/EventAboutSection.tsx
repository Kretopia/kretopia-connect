import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EventAboutSectionProps {
  description?: string | null;
}

export function EventAboutSection({ description }: EventAboutSectionProps) {
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
    <Card id="about">
      <CardContent className="space-y-4 p-4 md:p-6">
        <h2 className="text-xl font-semibold">About</h2>
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
      </CardContent>
    </Card>
  );
}
