import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Wand2 } from "lucide-react";

import { SEO } from "@/components/SEO";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import { HERO_PROMPTS } from "@/lib/heroJourneys";
import { fetchPublicSearch, resultHref, type PublicSearchResult } from "@/lib/publicSearch";
import { exploreByTarget, searchExploreBy, searchIntentTarget } from "@/lib/searchIntent";
import { broaderQuery, countResults, familyFromScope, familySources, scopeParamFor, SEARCH_FAMILIES, searchPageHref, type SearchFamily } from "@/lib/searchPageModel";
import { queryClass, resultsSummary, type RoutableResult } from "@/lib/searchResultView";
import { cn } from "@/lib/utils";

const LIMITS = { people: 12, opportunities: 12, events: 6, work: 8 } as const;
const MAX_QUERY = 120;
const MIN_QUERY = 2;

const kindOf = (r: PublicSearchResult): RoutableResult["kind"] => (r.type === "creator" ? "person" : r.type === "gig" ? "opportunity" : r.type === "event" ? "event" : "work");

/**
 * The Search Page: the public discovery layer between the landing and the deeper surfaces (spec 05). The query stays visible and
 * editable; the families offered are shown concisely and narrow the page without a form; results are grouped, neutral ("Results for
 * ...", never "jobs for you"), and each row says what it is, why it appears and what to do next. Everything shown is public and needs
 * no account (spec 24): a visitor and a member see the same rows, and a member's own context (saved, connected) is added as a mark
 * only on rows they could already see. Nothing here ranks or scores anyone, and nothing is redirected: an exact name or title is
 * routed by the search field that sent the visitor here; this page is the mixed view.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY);
  const family = familyFromScope(params.get("scope"));
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);

  const sources = familySources(family);
  const ready = query.length >= MIN_QUERY;
  const search = useQuery({
    queryKey: ["public-search", query.toLowerCase(), family],
    queryFn: () => fetchPublicSearch(query, sources, LIMITS),
    enabled: ready,
    staleTime: 30_000,
    retry: false,
  });
  const data = search.data;
  const roles = useMemo(() => (ready && sources.roles ? searchExploreBy(query, 6) : []), [ready, query, sources.roles]);
  const count = (data ? countResults(data) : 0) + roles.length;

  // A member's own context, only for rows already on the page: who they are connected to, which opportunities they saved. Both reads
  // are the member's own rows; a visitor makes neither.
  const peopleIds = data?.people.map((p) => p.id) ?? [];
  const opportunityIds = data?.opportunities.map((o) => o.id) ?? [];
  const personal = useQuery({
    queryKey: ["public-search-personal", user?.id ?? "visitor", peopleIds.join(","), opportunityIds.join(",")],
    enabled: !!user?.id && (peopleIds.length > 0 || opportunityIds.length > 0),
    staleTime: 60_000,
    queryFn: async () => {
      const connected = new Set<string>();
      const saved = new Set<string>();
      if (peopleIds.length) {
        const { data: links } = await supabase.from("connections").select("user_id, connected_user_id").or(`user_id.eq.${user!.id},connected_user_id.eq.${user!.id}`).eq("status", "accepted");
        for (const link of links ?? []) connected.add(link.user_id === user!.id ? link.connected_user_id : link.user_id);
      }
      if (opportunityIds.length) {
        const { data: rows } = await supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", user!.id).in("opportunity_id", opportunityIds);
        for (const row of rows ?? []) saved.add(row.opportunity_id);
      }
      return { connected, saved };
    },
  });
  const badgeFor = (r: PublicSearchResult): string | null =>
    r.type === "creator" && personal.data?.connected.has(r.id) ? "Connected" : r.type === "gig" && personal.data?.saved.has(r.id) ? "Saved" : null;

  // What is measured: the family, the kind of query and how many rows each group had, never the words.
  const settled = search.isSuccess;
  useEffect(() => {
    if (!settled || !data) return;
    const routable: RoutableResult[] = [...data.people, ...data.opportunities, ...data.work, ...data.events].map((r) => ({ kind: kindOf(r), id: r.id, title: r.title }));
    analytics.featureUsed("search_page_results", {
      family,
      class: queryClass(query, routable),
      people: data.people.length,
      opportunities: data.opportunities.length,
      work: data.work.length,
      events: data.events.length,
      roles: roles.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per answered search
  }, [settled, query, family]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim().slice(0, MAX_QUERY);
    setParams(next ? (family === "all" ? { q: next } : { q: next, scope: scopeParamFor(family) }) : {});
  };
  const chooseFamily = (next: SearchFamily) => {
    const entries: Record<string, string> = {};
    if (query) entries.q = query;
    if (next !== "all") entries.scope = scopeParamFor(next);
    setParams(entries);
  };
  const clicked = (group: string) => () => analytics.featureUsed("search_page_result_click", { family, group });

  return (
    <div className="min-h-screen bg-background">
      <SEO title={query ? `Results for “${query}” | Kretopia` : "Search | Kretopia"} description="Search people, roles, opportunities and work across the creative economy." noindex />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <header>
          <h1 className="sr-only">Search Kretopia</h1>
          <form role="search" onSubmit={submit} className="relative">
            <label htmlFor="search-page-field" className="sr-only">Search creatives, skills or opportunities</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="search-page-field"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_QUERY}
              placeholder="Search creatives, skills or opportunities…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-14 w-full rounded-[var(--k-hero-radius)] border border-border bg-card pl-12 pr-28 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            />
            <button type="submit" className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-[8px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Search
            </button>
          </form>

          {/* The families, concisely: they narrow the page, they are not tabs to other pages. */}
          <div role="radiogroup" aria-label="Search in" className="mt-3 flex max-w-full gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SEARCH_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={f.id === family}
                data-family={f.id}
                onClick={() => chooseFamily(f.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50",
                  f.id === family ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-6" aria-live="polite">
          {!ready ? <Start /> : search.isLoading ? (
            <KretopiaLoader label="Searching Kretopia" className="py-10" />
          ) : search.isError ? (
            <Failed onRetry={() => void search.refetch()} />
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground" data-testid="search-summary">
                {resultsSummary(query)}
                {count > 0 ? <span className="text-muted-foreground/70"> · {count} {count === 1 ? "result" : "results"}</span> : null}
              </p>
              {count === 0 ? <Empty query={query} family={family} /> : null}
            </>
          )}
        </div>

        {ready && data && !search.isLoading ? (
          <div className="mt-4 space-y-6">
            <Group title="Opportunities" caption="Jobs, projects, collaborations" rows={data.opportunities} badgeFor={badgeFor} onOpen={clicked("opportunities")} seeAll={{ label: `Open Scout for “${query}”`, to: searchIntentTarget("opportunities", query) }} />
            <Group title="People" caption="Creators and professionals" rows={data.people} badgeFor={badgeFor} onOpen={clicked("people")} seeAll={{ label: `See everyone for “${query}”`, to: searchIntentTarget("people", query) }} />
            <Group title="Work" caption="Projects and credits on Kretopia" rows={data.work} badgeFor={badgeFor} onOpen={clicked("work")} />
            <Group title="Events" caption="Coming up on Kretopia" rows={data.events} badgeFor={badgeFor} onOpen={clicked("events")} seeAll={{ label: `Search events for “${query}”`, to: `/meetup?q=${encodeURIComponent(query)}` }} />
            {roles.length > 0 ? (
              <GroupShell title="Roles & skills" caption="Meet the professionals in them">
                {roles.map(({ category, item }) => (
                  <Link key={`${category.id}-${item.label}`} to={exploreByTarget(item)} onClick={clicked("roles")} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground"><Wand2 className="h-5 w-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{category.label} · {item.description}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><span className="hidden sm:inline">Meet professionals</span><ArrowRight className="h-4 w-4" aria-hidden /></span>
                  </Link>
                ))}
              </GroupShell>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function GroupShell({ title, caption, children, footer }: { title: string; caption: string; children: ReactNode; footer?: ReactNode }) {
  const id = `search-group-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={id} className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="truncate text-xs text-muted-foreground">{caption}</span>
      </header>
      <div className="divide-y divide-border/60">{children}</div>
      {footer}
    </section>
  );
}

function Group({ title, caption, rows, badgeFor, onOpen, seeAll }: { title: string; caption: string; rows: PublicSearchResult[]; badgeFor: (r: PublicSearchResult) => string | null; onOpen: () => void; seeAll?: { label: string; to: string } }) {
  if (rows.length === 0) return null;
  return (
    <GroupShell
      title={title}
      caption={caption}
      footer={
        seeAll ? (
          <Link to={seeAll.to} className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{seeAll.label}</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {rows.map((r) => (
        <SearchResultRow key={`${r.type}-${r.id}`} result={r} href={resultHref(r)} onNavigate={onOpen} badge={badgeFor(r)} />
      ))}
    </GroupShell>
  );
}

/** No words yet (or one letter): a way in, with real example searches. */
function Start() {
  return (
    <section aria-label="Start a search" className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-foreground">What are you looking for?</p>
      <p className="mt-1 text-sm text-muted-foreground">A name, a role, a skill, an opportunity or a project.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {HERO_PROMPTS.map((p) => (
          <li key={p.query}>
            <Link to={searchPageHref(p.query)} className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50">
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-sm font-semibold text-destructive">The search could not finish</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Check your connection and try again.</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Try again
      </button>
    </div>
  );
}

/** Weak or empty: truthful, and still useful. No exact match is claimed; the next steps are adjacent ones (spec 15). */
function Empty({ query, family }: { query: string; family: SearchFamily }) {
  const broader = broaderQuery(query);
  const links: { label: string; to: string }[] = [];
  if (family !== "people") links.push({ label: `Explore people for “${query}”`, to: searchIntentTarget("people", query) });
  if (family !== "opportunities") links.push({ label: `See related opportunities for “${query}”`, to: searchIntentTarget("opportunities", query) });
  if (broader) links.push({ label: `Try a broader search: “${broader}”`, to: searchPageHref(broader, family) });
  else links.push({ label: "Browse people by role and skill", to: "/match?tab=browse&view=grid" });
  return (
    <section aria-label="No exact match" className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <p className="px-4 pt-4 text-sm text-foreground">We couldn’t find an exact match for “{query}”.</p>
      <p className="px-4 pb-2 text-xs text-muted-foreground">Here is where to go next.</p>
      <ul className="divide-y divide-border/60 border-t border-border">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{l.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
