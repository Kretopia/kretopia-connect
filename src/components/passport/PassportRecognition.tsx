import { Award, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RecognitionPress {
  id: string;
  title: string;
  publication?: string | null;
  url: string;
  image_url?: string | null;
}

export interface RecognitionAward {
  id: string;
  title: string;
  organization?: string | null;
  year?: number | string | null;
}

interface PassportRecognitionProps {
  /** Press the owner confirmed (the page reads only those), titles already decoded. */
  press: RecognitionPress[];
  awards: RecognitionAward[];
}

/**
 * "Featured In" and "Awards" side by side, under the Passport card and the record. They used to be stacked in the narrow card, which
 * made it far taller than the record beside it; as a band they read at the width of the page. With only one of the two, it takes the
 * whole width and lays its rows out in two columns, so the band is never half empty.
 */
export function PassportRecognition({ press, awards }: PassportRecognitionProps) {
  if (press.length === 0 && awards.length === 0) return null;
  const alone = press.length === 0 || awards.length === 0;
  const rows = cn("space-y-2", alone && "md:grid md:grid-cols-2 md:gap-2 md:space-y-0");

  return (
    <section aria-label="Featured in and awards" className="grid gap-6 md:grid-cols-2 md:gap-8">
      {press.length > 0 && (
        <div className={cn("min-w-0", alone && "md:col-span-2")}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured In</h3>
          <div className={rows}>
            {press.slice(0, 4).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
              >
                {item.image_url ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                    <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.publication}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {awards.length > 0 && (
        <div className={cn("min-w-0", alone && "md:col-span-2")}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Awards</h3>
          <div className={rows}>
            {awards.slice(0, 3).map((award) => (
              <div key={award.id} className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                <Award className="h-4 w-4 shrink-0 text-energy" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{award.title}</p>
                  <p className="text-xs text-muted-foreground">{award.organization} • {award.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default PassportRecognition;
