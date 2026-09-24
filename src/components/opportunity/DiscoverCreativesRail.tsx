import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { HoloCard } from "@/components/passport/HoloCard";
import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import { ShieldCheck, MapPin, Star, MessageCircle, Handshake } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface CreativeRow {
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  verification_tier: string | null;
}

const STANDING_LABEL: Record<string, string> = {
  elite: "Elite Verified",
  industry: "Industry Verified",
  verified: "Verified",
};

/**
 * "Discover Creatives" — CEO overhaul, Scout's people-discovery rail.
 * A curated slice across disciplines, not the full searchable directory
 * (that's Passport Directory, /passport, unchanged) -- so a small random
 * cross-section, same Holo Card treatment, same real credits-count query
 * pattern as PassportDirectory's own cards.
 */
export function DiscoverCreativesRail() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [api, setApi] = useState<CarouselApi>();
  const [rows, setRows] = useState<CreativeRow[]>([]);
  const [creditsByUser, setCreditsByUser] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [messageTarget, setMessageTarget] = useState<CreativeRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id,username,full_name,role,avatar_url,cover_image_url,location,verification_tier")
        .not("username", "is", null)
        .not("role", "is", null)
        .order("level", { ascending: false, nullsFirst: false })
        .limit(60);
      if (cancelled) return;
      const list = (data as CreativeRow[]) || [];
      // Cross-section across disciplines: one per distinct role where
      // possible, rather than whoever has the highest level (which would
      // just repeat PassportDirectory's own top-of-list ordering).
      const seenRoles = new Set<string>();
      const spread: CreativeRow[] = [];
      for (const r of list) {
        const key = r.role || "";
        if (seenRoles.has(key) && spread.length < list.length) continue;
        seenRoles.add(key);
        spread.push(r);
        if (spread.length >= 12) break;
      }
      const picked = spread.length >= 6 ? spread : list.slice(0, 12);
      setRows(picked);
      setLoading(false);

      const ids = picked.map((r) => r.user_id).filter((id): id is string => !!id);
      if (ids.length === 0) return;
      const { data: creditsRows } = await supabase.from("credits").select("user_id").in("user_id", ids);
      if (cancelled) return;
      const tally: Record<string, number> = {};
      for (const row of creditsRows || []) tally[row.user_id] = (tally[row.user_id] ?? 0) + 1;
      setCreditsByUser(tally);
    })().catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold">Discover Creatives</h2>
        <p className="text-xs text-muted-foreground">Real Passports from across the industry, worldwide.</p>
      </div>
      <Carousel setApi={setApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Discover creatives">
        <CarouselContent className="-ml-3">
          {rows.map((p) => {
            if (!p.user_id) return null;
            const handle = p.username ? `@${p.username.replace(/^@/, "")}` : null;
            const profileHref = handle ? `/${handle}` : `/profile/${p.user_id}`;
            const tier = p.verification_tier?.toLowerCase();
            const standing = tier ? STANDING_LABEL[tier] : null;
            const credits = creditsByUser[p.user_id] ?? 0;
            return (
              <CarouselItem key={p.user_id} className="pl-3 basis-[80%] sm:basis-[46%] lg:basis-[29%]">
                <HoloCard className="h-full">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(profileHref)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(profileHref); } }}
                    className="rounded-2xl bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal-teal))]"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-muted">
                      {p.cover_image_url ? (
                        <img src={p.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-[hsl(var(--signal-teal))]/15 to-transparent" />
                      )}
                      {standing && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--signal-teal))] backdrop-blur-sm">
                          <ShieldCheck className="h-3 w-3" />
                          {standing}
                        </span>
                      )}
                      <Avatar className="absolute -bottom-6 left-4 h-14 w-14 ring-2 ring-card">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback>{(p.full_name || p.username || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="p-4 pt-8 space-y-1.5">
                      <p className="font-semibold text-foreground truncate">{p.full_name || p.username}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {p.role && <span>{p.role}</span>}
                        {p.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {p.location}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
                        {credits} credit{credits === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 border-t border-border/60 bg-card p-2 rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={() => navigate(profileHref)}>
                      View Passport
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 flex-1 gap-1 text-xs" onClick={() => navigate(profileHref)}>
                      <Handshake className="h-3 w-3" /> Collaborate
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" aria-label={`Message ${p.full_name || p.username}`} onClick={() => setMessageTarget(p)}>
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </HoloCard>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {messageTarget?.user_id && (
        <DirectMessageDialog
          open={!!messageTarget}
          onOpenChange={(o) => !o && setMessageTarget(null)}
          recipientId={messageTarget.user_id}
          recipientName={messageTarget.full_name || messageTarget.username || "this creator"}
          recipientAvatar={messageTarget.avatar_url}
        />
      )}
    </section>
  );
}

export default DiscoverCreativesRail;
