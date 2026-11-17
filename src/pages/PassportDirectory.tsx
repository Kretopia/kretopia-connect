import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Fingerprint, IdCard, MessageCircle, Search as SearchIcon, SlidersHorizontal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { KretoScene } from "@/components/brand/KretoScene";
import { KretoMark } from "@/components/brand/KretoMark";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import { PassportDirectoryCard, passportHref, type DirectoryPassport } from "@/components/passport/PassportDirectoryCard";
import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { BRAND } from "@/lib/brandLexicon";
import { APP_URL } from "@/lib/constants";
import { ScoutFieldCarousel } from "@/components/scout/ScoutFieldCarousel";
import { groupCreatorsByCraft } from "@/components/discover/creatorCategories";
import { lazy, Suspense } from "react";
const StartProjectDialog = lazy(() => import("@/components/project/StartProjectFromMatchDialog").then(m => ({ default: m.StartProjectFromMatchDialog })));

const DIRECTORY_TUTORIAL: TutorialStep[] = [
  { icon: SearchIcon, title: "Search the record", body: "Find a creative by name, @handle, role or city, then narrow by profession, place or standing." },
  { icon: IdCard, title: "Read the Passport", body: "Each card shows standing, credits and co-signs taken from the real record, not a self-description." },
  { icon: MessageCircle, title: "Open or message", body: "Open their Passport in one tap, or send a direct message without leaving the directory." },
  { icon: Fingerprint, title: "Go to your own", body: "Open my Passport at the top takes you straight to yours." },
];

const ASK_KRETO_PROMPT =
  "Help me find the right creatives in the Passport Directory. Ask me what I need, then tell me which credits and co-signs to look for.";

const isVerified = (tier: string | null) => {
  const t = tier?.toLowerCase();
  return t === "verified" || t === "industry" || t === "elite";
};

const PassportDirectory = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [rows, setRows] = useState<DirectoryPassport[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [standingFilter, setStandingFilter] = useState("all");
  const [creditsByUser, setCreditsByUser] = useState<Record<string, number>>({});
  const [cosignsByUser, setCosignsByUser] = useState<Record<string, number>>({});
  const [messageTarget, setMessageTarget] = useState<DirectoryPassport | null>(null);
  const [projectTarget, setProjectTarget] = useState<DirectoryPassport | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setConnectedIds(new Set());
    if (!user?.id) return;
    Promise.all([
      supabase.from("connections").select("connected_user_id,status").eq("user_id", user.id),
      supabase.from("connections").select("user_id,status").eq("connected_user_id", user.id),
    ]).then(([outgoing, incoming]) => {
      if (cancelled || outgoing.error || incoming.error) return;
      setConnectedIds(new Set([
        ...(outgoing.data ?? []).filter(c => c.status === "accepted").map(c => c.connected_user_id),
        ...(incoming.data ?? []).filter(c => c.status === "accepted").map(c => c.user_id),
      ]));
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("public_profiles_safe")
        .select("user_id,username,full_name,role,avatar_url,cover_image_url,location,verification_tier,level,bio,professional_skills")
        .not("username", "is", null)
        .order("level", { ascending: false, nullsFirst: false })
        .order("user_id")
        .range((page - 1) * 36, page * 36);
      if (cancelled) return;
      if (error) throw error;
      setHasMore((data?.length ?? 0) > 36);
      const list = ((data as Array<Omit<DirectoryPassport, "user_id"> & { user_id: string | null }>) || []).filter(
        (r): r is DirectoryPassport => !!r.user_id,
      );
      setRows(previous => [...new Map([...(page === 1 ? [] : previous), ...list.slice(0, 36)].map(p => [p.user_id, p])).values()]);
      setLoading(false);

      // Real credits and co-sign counts: one batched tally each over every
      // visible user_id, not a query per card.
      const ids = list.map((r) => r.user_id);
      if (ids.length === 0) return;
      const [creditsRes, reviewsRes] = await Promise.all([
        supabase.from("credits").select("user_id").in("user_id", ids),
        supabase.from("company_reviews").select("company_id").in("company_id", ids).eq("status", "approved"),
      ]);
      if (cancelled) return;
      const credits: Record<string, number> = {};
      for (const row of creditsRes.data || []) credits[row.user_id] = (credits[row.user_id] ?? 0) + 1;
      setCreditsByUser(previous => ({ ...previous, ...credits }));
      const cosigns: Record<string, number> = {};
      for (const row of reviewsRes.data || []) cosigns[row.company_id] = (cosigns[row.company_id] ?? 0) + 1;
      setCosignsByUser(previous => ({ ...previous, ...cosigns }));
    })().catch(() => { if (!cancelled) { setLoading(false); setLoadError(true); } });
    return () => {
      cancelled = true;
    };
  }, [page, retry]);

  // Option lists come from the fetched rows: this directory spans every
  // discipline on Kretopia, so there is no fixed enum to guess.
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
    const list = rows.filter((r) => {
      if (professionFilter !== "all" && r.role !== professionFilter) return false;
      if (locationFilter !== "all" && r.location !== locationFilter) return false;
      if (standingFilter === "verified" && !isVerified(r.verification_tier)) return false;
      if (standingFilter === "working" && isVerified(r.verification_tier)) return false;
      if (!q) return true;
      return [r.username, r.full_name, r.role, r.location].some((v) => v?.toLowerCase().includes(q));
    });
    // Your own card first, so it is never lost in 120 others.
    return user?.id ? [...list].sort((a, b) => Number(b.user_id === user.id) - Number(a.user_id === user.id)) : list;
  }, [rows, query, professionFilter, locationFilter, standingFilter, user?.id]);

  const hasFilters = professionFilter !== "all" || locationFilter !== "all" || standingFilter !== "all";
  const askKreto = () =>
    window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: { prompt: ASK_KRETO_PROMPT } }));

  const ContentShell = embedded ? Fragment : StudioFeatureShell;

  return (
    <div className={embedded ? "space-y-4" : "accent-passport min-h-screen bg-background pb-24"}>
      {!embedded && <SEO
        title="Passport Directory — The verified creative record | Kretopia"
        description={BRAND.passportHeadline + " " + BRAND.passportSubline}
        url={`${APP_URL}/passport`}
      />}

      {!embedded && <div className="relative">

        <FeaturePageHeader
          scene="passport"
          eyebrow="Passport Directory"
          title="Passport Directory."
          accentTitle="The verified creative record."
          subtitle="Find the people behind the work, read their record, and open their Passport in one tap."
          tutorial={{ featureKey: "passport-directory", label: "How the Passport Directory works", steps: DIRECTORY_TUTORIAL }}
        />
      </div>}

      <ContentShell
        {...(embedded ? {} : { wrapped: {
          name: "Passport Directory",
          status: (
            <WrappedStatus
              active={!loading && rows.length > 0}
              label={loading ? "Loading the record…" : `${rows.length.toLocaleString()} verified creative record${rows.length === 1 ? "" : "s"}`}
            />
          ),
        } })}
      >
        {/* Your Passport, and Kreto: the way to your own record is the first thing in the panel. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          <KretoScene scene="passport" size="thumb" lazy={false} className="hidden h-16 w-28 shrink-0 rounded-xl border border-border sm:block" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your Passport</p>
            <p className="mt-1 text-sm text-foreground">
              {user
                ? "Go straight to your own record, or ask Kreto who to look for."
                : "Create your Passport to join the directory, or ask Kreto who to look for."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <CtaButton
              size="sm"
              className="w-full gap-1.5 sm:w-auto"
              onClick={() => navigate(user ? "/profile" : "/auth?next=/profile")}
            >
              <Fingerprint className="h-4 w-4" aria-hidden />
              {user ? "Open my Passport" : "Create my Passport"}
            </CtaButton>
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={askKreto}>
              <KretoMark size="xs" variant="bare" />
              Ask Kreto
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <KretopiaIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the Passport Directory"
              placeholder="Search by name, @handle, role, or city…"
              className="h-11 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Select value={professionFilter} onValueChange={setProfessionFilter}>
              <SelectTrigger aria-label="Profession" className="h-9 w-auto min-w-[140px] text-xs"><SelectValue placeholder="Profession" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every profession</SelectItem>
                {professionOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger aria-label="Location" className="h-9 w-auto min-w-[140px] text-xs"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everywhere</SelectItem>
                {locationOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={standingFilter} onValueChange={setStandingFilter}>
              <SelectTrigger aria-label="Standing" className="h-9 w-auto min-w-[140px] text-xs"><SelectValue placeholder="Standing" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every standing</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="working">Working Creative</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
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
        </div>

        {loadError ? <div role="alert" className="py-8 text-center"><p className="text-sm text-destructive">Couldn't load the directory.</p><Button variant="outline" onClick={() => setRetry(p => p + 1)}>Try again</Button></div> : loading ? (
          <div className="flex justify-center py-16">
            <KretopiaLoader label="Loading the record" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <KretoScene scene="talent-search" size="thumb" className="h-24 w-44 rounded-2xl border border-border" />
            <p className="text-sm text-muted-foreground">No Passports match that search yet.</p>
            {hasMore && <Button variant="outline" onClick={() => setPage(p => p + 1)}>Search more Passports</Button>}
            <div className="flex flex-wrap justify-center gap-2">
              {query && (
                <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>Clear search</Button>
              )}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={askKreto}>
                <KretoMark size="xs" variant="bare" />
                Ask Kreto
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupCreatorsByCraft(filtered).map(group => <section key={group.id} className="min-w-0" aria-label={group.label}>
            <ScoutFieldCarousel label={group.label} heading={<h2 className="text-sm font-bold">{group.label} <span className="ml-2 font-normal tabular-nums text-muted-foreground">{group.creators.length}</span></h2>}>
            {group.creators.map((p) => <li key={p.user_id}>
              <PassportDirectoryCard
                key={p.user_id}
                passport={p}
                credits={creditsByUser[p.user_id] ?? 0}
                cosigns={cosignsByUser[p.user_id] ?? 0}
                isMe={p.user_id === user?.id}
                connected={connectedIds.has(p.user_id)}
                onMessage={p => { if (connectedIds.has(p.user_id)) setMessageTarget(p); else navigate(user ? passportHref(p) : `/auth?next=${encodeURIComponent(passportHref(p))}`); }}
                onProject={p => { if (connectedIds.has(p.user_id)) setProjectTarget(p); }}
              />
            </li>)}
            </ScoutFieldCarousel></section>)}
            {hasMore && <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={loading}>Load more Passports</Button>}
          </div>
        )}
      </ContentShell>

      {messageTarget && (
        <DirectMessageDialog
          open={!!messageTarget}
          onOpenChange={(o) => !o && setMessageTarget(null)}
          recipientId={messageTarget.user_id}
          recipientName={messageTarget.full_name || messageTarget.username || "this creator"}
          recipientAvatar={messageTarget.avatar_url}
        />
      )}
      {projectTarget && <Suspense fallback={<KretopiaLoader size="sm" label="Opening project" />}><StartProjectDialog open onOpenChange={open => { if (!open) setProjectTarget(null); }} matchedUser={{ id: projectTarget.user_id, name: projectTarget.full_name || projectTarget.username || "Creator", role: projectTarget.role || "Creator", avatar: projectTarget.avatar_url }} /></Suspense>}
    </div>
  );
};

export default PassportDirectory;
