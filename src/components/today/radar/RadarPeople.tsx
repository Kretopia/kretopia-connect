import { MapPin, ShieldCheck } from "lucide-react";

import { MediaImage } from "@/components/media/MediaImage";
import { PersonAvatar } from "@/components/media/PersonAvatar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { OutlineCta } from "@/components/ui/glass-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { CreditEvidenceInput } from "@/lib/creditEvidence";
import { profileHref, standingLabel, summarizeCredits } from "@/lib/discoverCreatives";
import type { PersonToMeet } from "./radar.logic";
import type { SignalState } from "./useRadar";

/**
 * Discover Creatives, inside the Radar: real public Passports ranked for this
 * person, each with the one factual reason it is suggested. It scrolls by hand
 * (touch, trackpad, arrows, keyboard), never moves on its own, and every
 * Passport has exactly one action.
 */
export function RadarPeople({
  people,
  credits,
  state,
}: {
  people: PersonToMeet[];
  credits: Record<string, CreditEvidenceInput[]>;
  state: SignalState;
}) {
  const reducedMotion = useReducedMotion();
  if (state === "ready" && people.length === 0) return null;

  return (
    <section aria-labelledby="discover-creatives-title" className="space-y-3">
      <div>
        <h3 id="discover-creatives-title" className="text-base font-bold text-foreground">
          Discover Creatives
        </h3>
        <p className="text-xs text-muted-foreground">Real Passports from the Kretopia community.</p>
      </div>

      {state === "loading" ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 shrink-0 basis-[78%] rounded-2xl sm:basis-[46%] lg:basis-[29%]" />
          ))}
        </div>
      ) : state === "error" ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Couldn't load creatives right now.</p>
      ) : (
        <div className="relative">
          <Carousel opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Discover creatives">
            <CarouselContent className="-ml-3">
              {people.map(({ person: p, reason, isNew }) => {
                const name = p.full_name || p.username || "Creator";
                const standing = standingLabel(p.verification_tier);
                const creditsLabel = summarizeCredits(credits[p.user_id] ?? []);
                return (
                  <CarouselItem key={p.user_id} className="basis-[78%] pl-3 sm:basis-[46%] lg:basis-[29%]">
                    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors focus-within:border-[hsl(var(--energy)/0.45)] hover:border-[hsl(var(--energy)/0.45)]">
                      <div className="relative">
                        <MediaImage
                          src={p.cover_image_url}
                          alt=""
                          aspect="aspect-[16/9]"
                          fallback={<div className="h-full w-full bg-gradient-to-br from-[hsl(var(--energy)/0.16)] via-muted to-card" />}
                        />
                        {(standing || isNew) && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-foreground">
                            {standing ? <ShieldCheck className="h-3 w-3 text-[hsl(var(--energy))]" aria-hidden /> : null}
                            {standing ?? "New"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                        <PersonAvatar src={p.avatar_url} name={name} className="-mt-7 h-14 w-14 text-lg ring-2 ring-card" />
                        <div className="min-w-0 space-y-1">
                          <h4 className="truncate font-semibold text-foreground">{name}</h4>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {p.role && <span>{p.role}</span>}
                            {p.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden />
                                {p.location}
                              </span>
                            )}
                          </p>
                          {creditsLabel && <p className="text-[11px] text-muted-foreground">{creditsLabel}</p>}
                        </div>
                        <p className="rounded-lg border border-[hsl(var(--energy)/0.25)] bg-[hsl(var(--energy)/0.06)] px-2.5 py-1.5 text-[11px] leading-snug text-foreground">
                          <span className="sr-only">Why: </span>
                          {reason}
                        </p>
                        <OutlineCta to={profileHref(p)} className="mt-auto min-h-11 w-full" aria-label={`View ${name}'s Passport`}>
                          View Passport
                        </OutlineCta>
                      </div>
                    </article>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous creatives" />
            <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next creatives" />
          </Carousel>
          {/* On touch the next Passport peeks in from the right; this just makes that edge read as "more". */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden" />
        </div>
      )}
    </section>
  );
}

export default RadarPeople;
