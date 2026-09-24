import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/brand/BrandDots";
import { ShieldCheck, MapPin, Search as SearchIcon, Fingerprint, Star, Users2, MessageCircle } from "lucide-react";
import { BRAND } from "@/lib/brandLexicon";
import { StaggerHeading } from "@/components/typography/StaggerReveal";
import { APP_URL } from "@/lib/constants";
import { HoloCard } from "@/components/passport/HoloCard";
import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import kretoConnector from "@/assets/brand/kreto/kreto-connector-cutout.png";

interface PassportRow {
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  verification_tier: string | null;
  level: number | null;
}

const STANDING_LABEL: Record<string, string> = {
  elite: "Elite Verified",
  industry: "Industry Verified",
  verified: "Verified",
};

const passportIdFor = (userId: string) =>
  `THR-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

const PassportDirectory = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PassportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [professionFilter, setProfessionFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [standingFilter, setStandingFilter] = useState<string>("all");
  const [creditsByUser, setCreditsByUser] = useState<Record<string, number>>({});
  const [cosignsByUser, setCosignsByUser] = useState<Record<string, number>>({});
  const [messageTarget, setMessageTarget] = useState<PassportRow | null>(null);
  // Most Passports here have no cover_image_url set yet -- the old fallback
  // (a bare 15%-opacity gradient div, no icon) read as an almost-invisible
  // black box against the dark theme, not a real placeholder. Every card
  // now gets a real picture: the real cover if it loads, a branded Kreto
  // illustration if there isn't one or it fails to load.
  const [brokenCoverIds, setBrokenCoverIds] = useState<Set<string>>(new Set());
  const markCoverBroken = (id: string) =>
    setBrokenCoverIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id,username,full_name,role,avatar_url,cover_image_url,location,verification_tier,level")
        .not("username", "is", null)
        .order("level", { ascending: false, nullsFirst: false })
        .limit(120);
      if (cancelled) return;
      const list = (data as PassportRow[]) || [];
      setRows(list);
      setLoading(false);

      // Real credits + co-sign counts for the Holo Cards -- one tally query
      // each over every visible user_id, same batched-count pattern used
      // for StudioProjectsDashboard's participantsByProject, rather than a
      // per-card query for up to 120 cards.
      const ids = list.map((r) => r.user_id).filter((id): id is string => !!id);
      if (ids.length === 0) return;
      const [creditsRes, reviewsRes] = await Promise.all([
        supabase.from("credits").select("user_id").in("user_id", ids),
        supabase.from("company_reviews").select("company_id").in("company_id", ids).eq("status", "approved"),
      ]);
      if (cancelled) return;
      const creditsTally: Record<string, number> = {};
      for (const row of creditsRes.data || []) {
        creditsTally[row.user_id] = (creditsTally[row.user_id] ?? 0) + 1;
      }
      setCreditsByUser(creditsTally);
      const cosignsTally: Record<string, number> = {};
      for (const row of reviewsRes.data || []) {
        cosignsTally[row.company_id] = (cosignsTally[row.company_id] ?? 0) + 1;
      }
      setCosignsByUser(cosignsTally);
    })().catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter option lists -- derived from the real fetched rows, never a
  // guessed/hardcoded taxonomy (this directory spans every discipline on
  // Kretopia, not a fixed enum).
  const professionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.role).filter((r): r is string => !!r))).sort(),
    [rows],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.location).filter((l): l is string => !!l))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (professionFilter !== "all" && r.role !== professionFilter) return false;
      if (locationFilter !== "all" && r.location !== locationFilter) return false;
      if (standingFilter !== "all") {
        const tier = r.verification_tier?.toLowerCase();
        if (standingFilter === "verified" && !(tier === "verified" || tier === "industry" || tier === "elite")) return false;
        if (standingFilter === "working" && (tier === "verified" || tier === "industry" || tier === "elite")) return false;
      }
      return true;
    });
    if (!q) return base;
    return base.filter(
      (r) =>
        r.username?.toLowerCase().includes(q) ||
        r.full_name?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q)
    );
  }, [rows, query, professionFilter, locationFilter, standingFilter]);

  return (
    <div className="accent-passport min-h-screen bg-background pb-24">
      <SEO
        title="Passport Directory — The verified creative record | Kretopia"
        description={BRAND.passportHeadline + " " + BRAND.passportSubline}
        url={`${APP_URL}/passport`}
      />

      <div className="container mx-auto max-w-6xl px-4 py-10 sm:py-16">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--signal-teal))] mb-4 px-3 py-1 rounded-full border border-[hsl(var(--signal-teal))]/30 bg-[hsl(var(--signal-teal))]/[0.04]">
            <Fingerprint className="h-3 w-3" />
            Passport Directory
          </p>
          <StaggerHeading
            text={BRAND.passportHeadline}
            className="font-serif text-3xl sm:text-5xl leading-[1.05] tracking-[-0.02em] text-foreground mb-3"
          />
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            {BRAND.passportSubline}
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            {rows.length.toLocaleString()} verified creative record{rows.length === 1 ? "" : "s"} and counting.
          </p>
        </div>

        {/* Search */}
        <div className="mt-8 relative max-w-xl">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, @handle, role, or city…"
            className="pl-9 h-11"
          />
        </div>

        {/* Filters -- options derived from the real fetched rows, not a
            guessed taxonomy. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={professionFilter} onValueChange={setProfessionFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs"><SelectValue placeholder="Profession" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every profession</SelectItem>
              {professionOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everywhere</SelectItem>
              {locationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={standingFilter} onValueChange={setStandingFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs"><SelectValue placeholder="Standing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every standing</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="working">Working Creative</SelectItem>
            </SelectContent>
          </Select>
          {(professionFilter !== "all" || locationFilter !== "all" || standingFilter !== "all") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => { setProfessionFilter("all"); setLocationFilter("all"); setStandingFilter("all"); }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Grid */}
        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <BrandLoader />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <SearchIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No Passports match that search yet.</p>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                if (!p.user_id) return null;
                const handle = p.username ? `@${p.username.replace(/^@/, "")}` : null;
                const profileHref = handle ? `/${handle}` : `/profile/${p.user_id}`;
                const tid = passportIdFor(p.user_id);
                const tier = p.verification_tier?.toLowerCase();
                const standing = tier ? STANDING_LABEL[tier] : null;
                const credits = creditsByUser[p.user_id] ?? 0;
                const cosigns = cosignsByUser[p.user_id] ?? 0;
                return (
                  <HoloCard key={p.user_id} className="h-full">
                    <Link
                      to={profileHref}
                      className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--signal-teal))]"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-muted">
                        {p.cover_image_url && !brokenCoverIds.has(p.user_id) ? (
                          <img
                            src={p.cover_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => markCoverBroken(p.user_id!)}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-[hsl(var(--signal-teal))]/20 via-[hsl(var(--signal-teal))]/5 to-transparent flex items-center justify-center">
                            <img src={kretoConnector} alt="" className="h-20 w-20 object-contain opacity-90" />
                          </div>
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
                      <div className="rounded-b-2xl bg-card p-4 pt-8 space-y-2">
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
                        <p className="text-[10px] font-mono text-muted-foreground/70">{tid}</p>
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
                            {credits} credit{credits === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users2 className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
                            {cosigns} co-sign{cosigns === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 border-t border-border/60 bg-card p-2 rounded-b-2xl">
                      <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={() => navigate(profileHref)}>
                        View Passport
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 flex-1 gap-1 text-xs"
                        onClick={() => setMessageTarget(p)}
                      >
                        <MessageCircle className="h-3 w-3" /> Message
                      </Button>
                    </div>
                  </HoloCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {messageTarget?.user_id && (
        <DirectMessageDialog
          open={!!messageTarget}
          onOpenChange={(o) => !o && setMessageTarget(null)}
          recipientId={messageTarget.user_id}
          recipientName={messageTarget.full_name || messageTarget.username || "this creator"}
          recipientAvatar={messageTarget.avatar_url}
        />
      )}
    </div>
  );
};

export default PassportDirectory;
