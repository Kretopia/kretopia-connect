import { useQuery } from "@tanstack/react-query";
import { MapPin, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MediaImage } from "@/components/media/MediaImage";
import { PersonAvatar } from "@/components/media/PersonAvatar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { OutlineCta } from "@/components/ui/glass-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { CreditEvidenceInput } from "@/lib/creditEvidence";
import {
  profileHref,
  spreadAcrossRoles,
  standingLabel,
  summarizeCredits,
  type CreativeRow,
} from "@/lib/discoverCreatives";

type Creative = CreativeRow & { creditsLabel: string | null };

/**
 * One read of the public Passports (public_profiles_safe, the same guest-safe
 * view the rest of the app uses) plus the credit rows the viewer's RLS already
 * lets them see for those people. Cached, so leaving Today and coming back
 * does not refetch it.
 */
async function fetchCreatives(): Promise<Creative[]> {
  const { data, error } = await supabase
    .from("public_profiles_safe")
    .select("user_id,username,full_name,role,avatar_url,cover_image_url,location,verification_tier")
    .not("username", "is", null)
    .not("role", "is", null)
    .order("level", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;

  const picked = spreadAcrossRoles((data as CreativeRow[]) ?? []);
  const ids = picked.map((r) => r.user_id).filter((id): id is string => !!id);
  const creditsByUser = new Map<string, CreditEvidenceInput[]>();
  if (ids.length > 0) {
    const { data: credits } = await supabase
      .from("credits")
      .select("user_id, verification_status, verification_url, endorsement_count, verified_by_name, verified_by_user_id")
      .in("user_id", ids);
    for (const c of (credits as Array<CreditEvidenceInput & { user_id: string }> | null) ?? []) {
      const list = creditsByUser.get(c.user_id) ?? [];
      list.push(c);
      creditsByUser.set(c.user_id, list);
    }
  }
  return picked.map((r) => ({ ...r, creditsLabel: summarizeCredits(creditsByUser.get(r.user_id!) ?? []) }));
}

/**
 * Discover Creatives: continuity, not an urgent task. It sits after Today's
 * primary cards, scrolls by hand (touch, trackpad, arrow buttons, keyboard)
 * and never moves on its own. Each Passport shows only what the public view
 * and credits RLS return, and has exactly one action.
 */
export function TodayDiscoverCreatives() {
  const reducedMotion = useReducedMotion();
  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ["discover-creatives"],
    queryFn: fetchCreatives,
    staleTime: 10 * 60_000,
  });

  if (!isLoading && creatives.length === 0) return null;

  return (
    <section aria-labelledby="discover-creatives-title" className="space-y-3">
      <div>
        <h2 id="discover-creatives-title" className="text-base font-bold text-foreground">
          Discover Creatives
        </h2>
        <p className="text-xs text-muted-foreground">Real Passports from the Kretopia community.</p>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 shrink-0 basis-[78%] rounded-2xl sm:basis-[46%] lg:basis-[29%]" />
          ))}
        </div>
      ) : (
        <div className="relative">
          <Carousel
            opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }}
            className="w-full"
            aria-label="Discover creatives"
          >
            <CarouselContent className="-ml-3">
              {creatives.map((p) => {
                const name = p.full_name || p.username || "Creator";
                const standing = standingLabel(p.verification_tier);
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
                        {standing && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-foreground">
                            <ShieldCheck className="h-3 w-3 text-[hsl(var(--energy))]" aria-hidden />
                            {standing}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                        <PersonAvatar src={p.avatar_url} name={name} className="-mt-7 h-14 w-14 text-lg ring-2 ring-card" />
                        <div className="min-w-0 space-y-1">
                          <h3 className="truncate font-semibold text-foreground">{name}</h3>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {p.role && <span>{p.role}</span>}
                            {p.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden />
                                {p.location}
                              </span>
                            )}
                          </p>
                          {p.creditsLabel && <p className="text-[11px] text-muted-foreground">{p.creditsLabel}</p>}
                        </div>
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
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
        </div>
      )}
    </section>
  );
}

export default TodayDiscoverCreatives;
