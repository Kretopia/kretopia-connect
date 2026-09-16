import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/brand/BrandDots";
import { ShieldCheck, MapPin, Search as SearchIcon, Fingerprint } from "lucide-react";
import { BRAND } from "@/lib/brandLexicon";
import { StaggerHeading } from "@/components/typography/StaggerReveal";
import { APP_URL } from "@/lib/constants";

interface PassportRow {
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  location: string | null;
  verification_tier: string | null;
  level: number | null;
}

const passportIdFor = (userId: string) =>
  `THR-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

const PassportDirectory = () => {
  const [rows, setRows] = useState<PassportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id,username,full_name,role,avatar_url,location,verification_tier,level")
        .not("username", "is", null)
        .order("level", { ascending: false, nullsFirst: false })
        .limit(120);
      if (!cancelled) {
        setRows((data as PassportRow[]) || []);
        setLoading(false);
      }
    })().catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.username?.toLowerCase().includes(q) ||
        r.full_name?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q)
    );
  }, [rows, query]);

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

        {/* Grid */}
        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <BrandLoader />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No Passports match that search yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                if (!p.user_id) return null;
                const handle = p.username ? `@${p.username.replace(/^@/, "")}` : null;
                const tid = passportIdFor(p.user_id);
                const tier = p.verification_tier?.toLowerCase();
                const isVerified = tier === "verified" || tier === "industry" || tier === "elite";
                return (
                  <Link
                    key={p.user_id}
                    to={handle ? `/${handle}` : `/profile/${p.user_id}`}
                    className="group"
                  >
                    <Card className="p-4 h-full hover:border-[hsl(var(--signal-teal))]/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 ring-1 ring-border">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(p.full_name || p.username || "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground truncate">
                              {p.full_name || p.username}
                            </p>
                            {isVerified && (
                              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))] shrink-0" />
                            )}
                          </div>
                          {handle && (
                            <p className="text-xs text-muted-foreground truncate">{handle}</p>
                          )}
                          <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                            {tid}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.role && (
                          <Badge variant="secondary" className="text-[10px]">
                            {p.role}
                          </Badge>
                        )}
                        {p.location && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {p.location}
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PassportDirectory;
