import { createContext, useContext, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, CalendarDays, ChevronRight, Clapperboard, Lock, Music, Palette, Radio, Search, Wand2, type LucideIcon } from "lucide-react";

import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  EXPLORE_BY,
  exploreByCategory,
  searchExploreBy,
  searchIntentMeta,
  type ExploreByCategoryId,
  type ExploreByItem,
  type SearchIntent,
} from "@/lib/searchIntent";
import { scopeSources, searchScopeMeta, type SearchScope } from "@/lib/heroSearchScope";
import { cn } from "@/lib/utils";

/** What the panel needs of a result row: people and opportunities share the same shape. */
export interface IntentResult {
  type: "creator" | "gig" | "event";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
}

/** For a guest, rows say "this needs an account" with a lock where the arrow would be. */
const LockedContext = createContext(false);

function Go({ className }: { className?: string }) {
  const locked = useContext(LockedContext);
  return locked ? (
    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Needs an account" />
  ) : (
    <ArrowRight className={cn("h-4 w-4 shrink-0 text-primary", className)} aria-hidden />
  );
}

const CATEGORY_ICON: Record<ExploreByCategoryId, LucideIcon> = {
  disciplines: Palette,
  crew: Clapperboard,
  skills: Wand2,
  studios: Building2,
  music: Music,
};

interface HeroIntentPanelProps {
  query: string;
  people: IntentResult[];
  opportunities: IntentResult[];
  loading: boolean;
  error: boolean;
  /** The "Explore by" category that is open, or null for the list of categories. */
  category: ExploreByCategoryId | null;
  onCategoryChange: (id: ExploreByCategoryId | null) => void;
  /** Keyboard handler shared with the results, so the arrow keys walk the whole panel. */
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onSelectResult: (result: IntentResult) => void;
  onExplore: (item: ExploreByItem) => void;
  /** Open one section's full search (the Grid for People and Skills, Scout for Opportunities). */
  onSeeAll: (intent: SearchIntent) => void;
  onRetry: () => void;
  /**
   * The search scope. Left out, the panel answers in its three sections as it always did. Given, only the sources of that scope are
   * shown, Events has its own section, and SoundStages offers its search (its live list opens on its own page).
   */
  scope?: SearchScope;
  events?: IntentResult[];
  /** Open the full search behind a scope (its own page, with the words in its search bar). */
  onSeeAllScope?: (scope: SearchScope) => void;
  /** A guest: results are shown but none opens without an account, so rows carry a lock instead of an arrow. */
  locked?: boolean;
}

const row =
  "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";
const iconTile =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground/80 transition-colors group-hover:border-primary/40 group-hover:text-primary";

function Section({ intent, children }: { intent: SearchIntent; children: ReactNode }) {
  const meta = searchIntentMeta(intent);
  return (
    <section aria-label={meta.label} className="border-b border-border last:border-b-0">
      <header className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{meta.label}</h3>
        <span className="truncate text-[10px] text-muted-foreground/80">{meta.caption}</span>
      </header>
      {children}
    </section>
  );
}

/** A section that is not one of the three intents (Events): same header, same rows. */
function PlainSection({ label, caption, children }: { label: string; caption: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="border-b border-border last:border-b-0">
      <header className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</h3>
        <span className="truncate text-[10px] text-muted-foreground/80">{caption}</span>
      </header>
      {children}
    </section>
  );
}

/** Nothing typed yet in a scope that has no vocabulary to browse: say what the scope searches. */
function ScopeHint({ scope }: { scope: SearchScope }) {
  const meta = searchScopeMeta(scope);
  const Icon = scope === "events" ? CalendarDays : scope === "soundstages" ? Radio : scope === "scout" ? Briefcase : Search;
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <span className={iconTile}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">Searching {meta.label}</span>
        <span className="block text-xs text-muted-foreground">{meta.description}. Type a name, a skill, a discipline or a keyword.</span>
      </span>
    </div>
  );
}

function SeeAll({ label, onClick, onKeyDown }: { label: string; onClick: () => void; onKeyDown: HeroIntentPanelProps["onKeyDown"] }) {
  return (
    <button type="button" data-search-result onKeyDown={onKeyDown} onClick={onClick} className={cn(row, "py-2")}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 break-words text-xs font-medium text-primary">{label}</span>
      <Go />
    </button>
  );
}

function ResultRow({ result, onSelect, onKeyDown }: { result: IntentResult; onSelect: HeroIntentPanelProps["onSelectResult"]; onKeyDown: HeroIntentPanelProps["onKeyDown"] }) {
  return (
    <button type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onSelect(result)} className={row}>
      {result.type === "creator" ? (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={result.avatar || ""} />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{(result.title || "?")[0]}</AvatarFallback>
        </Avatar>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          {result.type === "event" ? <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden /> : <Briefcase className="h-3.5 w-3.5 text-primary" aria-hidden />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
        {result.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{result.subtitle}</span> : null}
      </span>
      <Go />
    </button>
  );
}

/** Nothing typed yet: "Explore by", five ways into the professionals on Kretopia, each one opening its own list. */
function ExploreBy({ category, onCategoryChange, onKeyDown, onExplore }: Pick<HeroIntentPanelProps, "category" | "onCategoryChange" | "onKeyDown" | "onExplore">) {
  const open = exploreByCategory(category);
  if (open) {
    return (
      <>
        <button type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onCategoryChange(null)} className={cn(row, "border-b border-border py-2")}>
          <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Explore by</span>
            <span className="block truncate text-sm font-semibold text-foreground">{open.label}</span>
          </span>
        </button>
        <div className="grid sm:grid-cols-2">
          {open.items.map((item) => (
            <button key={item.label} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onExplore(item)} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
              </span>
              <Go className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <header className="px-4 pb-1 pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Explore by</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Pick an area to meet the professionals in it, or start typing.</p>
      </header>
      {EXPLORE_BY.map((c) => {
        const Icon = CATEGORY_ICON[c.id];
        return (
          <button key={c.id} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onCategoryChange(c.id)} className={row}>
            <span className={iconTile}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{c.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{c.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        );
      })}
    </>
  );
}

/**
 * The hero search's answers. One field, no mode: with nothing typed it offers "Explore by"; once there are words it answers in
 * up to three sections (People, Skills, Opportunities), each only if it has something, each saying which feature it belongs to.
 * Real, public-safe records for a guest; semantic tokens only; the loader is the shared K mark.
 */
function HeroIntentPanelBody({ query, people, opportunities, loading, error, category, onCategoryChange, onKeyDown, onSelectResult, onExplore, onSeeAll, onRetry, scope, events = [], onSeeAllScope }: HeroIntentPanelProps) {
  const typed = query.trim();
  const sources = scope ? scopeSources(scope) : { people: true, skills: true, opportunities: true, events: false, stages: false };
  // The vocabulary ("Explore by") is for All and Match; the other scopes have none to browse.
  if (!typed) {
    return !scope || sources.skills ? <ExploreBy category={category} onCategoryChange={onCategoryChange} onKeyDown={onKeyDown} onExplore={onExplore} /> : <ScopeHint scope={scope} />;
  }

  const skills = sources.skills ? searchExploreBy(typed, 4) : [];
  const shownPeople = sources.people ? people : [];
  const shownOpportunities = sources.opportunities ? opportunities : [];
  const shownEvents = sources.events ? events : [];
  const hasAny = shownPeople.length > 0 || skills.length > 0 || shownOpportunities.length > 0 || shownEvents.length > 0;

  return (
    <>
      {shownPeople.length > 0 ? (
        <Section intent="people">
          {shownPeople.map((p) => <ResultRow key={`creator-${p.id}`} result={p} onSelect={onSelectResult} onKeyDown={onKeyDown} />)}
          <SeeAll label={`See everyone for “${typed}”`} onClick={() => onSeeAll("people")} onKeyDown={onKeyDown} />
        </Section>
      ) : null}

      {skills.length > 0 ? (
        <Section intent="skills">
          {skills.map(({ category: c, item }) => {
            const Icon = CATEGORY_ICON[c.id];
            return (
              <button key={`${c.id}-${item.label}`} type="button" data-search-result onKeyDown={onKeyDown} onClick={() => onExplore(item)} className={row}>
                <span className={iconTile}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.label} · {item.description}</span>
                </span>
                <Go />
              </button>
            );
          })}
          <SeeAll label={`Find professionals for “${typed}”`} onClick={() => onSeeAll("skills")} onKeyDown={onKeyDown} />
        </Section>
      ) : null}

      {shownOpportunities.length > 0 ? (
        <Section intent="opportunities">
          {shownOpportunities.map((o) => <ResultRow key={`gig-${o.id}`} result={o} onSelect={onSelectResult} onKeyDown={onKeyDown} />)}
          <SeeAll label={`Search Scout for “${typed}”`} onClick={() => onSeeAll("opportunities")} onKeyDown={onKeyDown} />
        </Section>
      ) : null}

      {shownEvents.length > 0 ? (
        <PlainSection label="Events" caption="Coming up on Kretopia">
          {shownEvents.map((e) => <ResultRow key={`event-${e.id}`} result={e} onSelect={onSelectResult} onKeyDown={onKeyDown} />)}
          <SeeAll label={`Search Events for “${typed}”`} onClick={() => onSeeAllScope?.("events")} onKeyDown={onKeyDown} />
        </PlainSection>
      ) : null}

      {sources.stages ? (
        <PlainSection label="SoundStages" caption="Live creative rooms">
          <SeeAll label={`Search SoundStages for “${typed}”`} onClick={() => onSeeAllScope?.("soundstages")} onKeyDown={onKeyDown} />
        </PlainSection>
      ) : null}

      {loading && !hasAny && !sources.stages ? <KretopiaLoader size="sm" label="Searching Kretopia" className="px-4" /> : null}

      {!loading && error && !hasAny ? (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-destructive">The search could not finish</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Check your connection and try again.</p>
          <button type="button" onClick={onRetry} className="mt-2 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && !hasAny && !sources.stages ? (
        <div>
          {scope && scope !== "all" ? (
            <>
              <p className="px-4 pb-1 pt-3 text-sm text-muted-foreground">Nothing matches “{typed}” in {searchScopeMeta(scope).label} yet. Open its full search:</p>
              <SeeAll
                label={`Search ${searchScopeMeta(scope).label} for “${typed}”`}
                onClick={() => (scope === "events" ? onSeeAllScope?.("events") : onSeeAll(scope === "scout" ? "opportunities" : scope === "match" ? "skills" : "people"))}
                onKeyDown={onKeyDown}
              />
            </>
          ) : (
            <>
              <p className="px-4 pb-1 pt-3 text-sm text-muted-foreground">Nothing matches “{typed}” yet. Search the whole of Kretopia instead:</p>
              <SeeAll label={`Search people and skills for “${typed}”`} onClick={() => onSeeAll("people")} onKeyDown={onKeyDown} />
              <SeeAll label={`Search opportunities for “${typed}”`} onClick={() => onSeeAll("opportunities")} onKeyDown={onKeyDown} />
              {scope === "all" ? <SeeAll label={`Search events for “${typed}”`} onClick={() => onSeeAllScope?.("events")} onKeyDown={onKeyDown} /> : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

export function HeroIntentPanel(props: HeroIntentPanelProps) {
  return (
    <LockedContext.Provider value={!!props.locked}>
      <HeroIntentPanelBody {...props} />
    </LockedContext.Provider>
  );
}

export default HeroIntentPanel;
