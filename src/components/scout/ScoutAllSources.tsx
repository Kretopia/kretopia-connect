import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, MapPin, Search, SlidersHorizontal, X } from "lucide-react";

import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { PILL_ITEM, PILL_ITEM_ACTIVE } from "@/components/discover/DiscoverSwitch";
import { ScoutGigCard } from "./ScoutGigCard";
import { ScoutFieldCarousel } from "./ScoutFieldCarousel";
import { useOptionalScoutScan } from "./scoutScanContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListingLabels } from "@/components/external/ListingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useScoutCatalog } from "@/hooks/useScoutCatalog";
import { CATEGORIES, LEVELS, categoryOf, type CategoryId, type Language, type Level, type WorkMode } from "@/lib/opportunityTaxonomy";
import { KRETOPIA_SOURCE, NO_FILTERS, facets, filterCatalog, filtersActive, groupByCategory, includeScoutedGigs, type CatalogFilters, type CatalogItem } from "@/lib/scoutCatalog";
import { cn } from "@/lib/utils";

/** Outside the creative families a section shows this many until opened, unless the person is searching or filtering. */
const COLLAPSED_MAX = 6;

const WORK_LABEL: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: "Not stated" };
const LANG_LABEL: Record<Language, string> = { en: "English", de: "German", other: "Other" };
const DAYS: { id: CatalogFilters["days"]; label: string }[] = [
  { id: 0, label: "Any time" },
  { id: 7, label: "7 days" },
  { id: 14, label: "14 days" },
  { id: 30, label: "30 days" },
];
// Many pills in one row (the families, the sources) scroll sideways instead of sharing the width, which would cut every label.
const RAIL = "flex w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const SMALL_PILL = "rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

interface PillOption<T> {
  id: T;
  label: string;
  count?: number;
}

/**
 * The families as chips. From `sm` up they wrap onto as many lines as they need, so none is hidden; on a phone, where seventeen chips
 * would push the list a screen and a half down, they are one row that scrolls sideways, with a fade at the edge as the hint.
 */
const CHIP =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 sm:min-h-9";
const CHIP_ROW =
  "flex gap-1.5 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-wrap overflow-visible [mask-image:none]";

function Chips<T extends string>({ label, options, isOn, onPick }: { label: string; options: PillOption<T>[]; isOn: (id: T) => boolean; onPick: (id: T) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className={CHIP_ROW}>
        {options.map((o) => (
          <Button variant="ghost" key={o.id} type="button" aria-pressed={isOn(o.id)} onClick={() => onPick(o.id)} className={cn(CHIP, isOn(o.id) && "border-transparent bg-background text-foreground shadow-sm ring-1 ring-border")}>
            {o.label}
            {o.count != null && <span className="tabular-nums text-[10px] opacity-70">{o.count}</span>}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** One row of the shared pill switcher: `isOn` says which are pressed. */
function Pills<T extends string | number>({ label, options, isOn, onPick }: { label: string; options: PillOption<T>[]; isOn: (id: T) => boolean; onPick: (id: T) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className={RAIL}>
        {options.map((o) => (
          <Button variant="ghost" key={String(o.id)} type="button" aria-pressed={isOn(o.id)} onClick={() => onPick(o.id)} className={cn(PILL_ITEM, isOn(o.id) && PILL_ITEM_ACTIVE)}>
            {o.label}
            {o.count != null && <span className="tabular-nums text-[10px] opacity-70">{o.count}</span>}
          </Button>
        ))}
      </div>
    </div>
  );
}

function when(item: CatalogItem): string | null {
  const iso = item.postedAt ?? null;
  if (!iso) return null;
  return `Posted ${formatDistanceToNow(new Date(iso), { addSuffix: true }).replace("about ", "")}`;
}

function FamilyPill({ id, primary }: { id: CategoryId; primary?: boolean }) {
  const def = categoryOf(id);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        primary && def.group === "creative" ? "border-energy/40 bg-energy/10 text-foreground" : "border-border bg-background text-muted-foreground",
      )}
    >
      {def.label}
    </span>
  );
}

function OpportunityCard({ item }: { item: CatalogItem }) {
  const place = [item.company, item.location].filter(Boolean).join(" · ");
  const posted = when(item);
  const levelLabel = item.level ? LEVELS.find((l) => l.id === item.level)?.label : null;
  return (
    // content-visibility keeps a few hundred cards cheap: the ones off screen are not laid out until they are near.
    <li className="[contain-intrinsic-size:auto_168px] [content-visibility:auto]">
      <ScoutGigCard title={item.title} image={item.image} href={item.detailTo} pay={item.pay} testId="catalog-card" badges={<FamilyPill id={item.category} primary />}>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.alsoIn.map((c) => (
            <FamilyPill key={c} id={c} />
          ))}
          {levelLabel && <span className={SMALL_PILL}>{levelLabel}</span>}
        </div>


        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {place && (
            <span className="inline-flex items-center gap-1" title={item.locationFull ?? undefined}>
              {item.location && <MapPin className="h-3 w-3 shrink-0" aria-hidden />}
              {place}
            </span>
          )}
          {item.workMode !== "unknown" && <span className={SMALL_PILL}>{WORK_LABEL[item.workMode]}</span>}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {posted && <span className="text-[11px] text-muted-foreground">{posted}</span>}
        </div>

        {item.more.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium text-foreground/80">Also posted for {item.more.length} more {item.more.length === 1 ? "place" : "places"}</summary>
            <ul className="mt-1 space-y-1">
              {item.more.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{m.place ?? "Another place"}</span>
                  {m.openUrl && (
                    <a href={m.openUrl} target="_blank" rel={item.openRel} className="shrink-0 font-semibold text-foreground underline underline-offset-2" aria-label={`Apply at source for ${m.place ?? "another place"}: ${item.title}`}>
                      Apply
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
          {item.origin === "external" ? (
            <ListingLabels claimed={item.claimed} lastCheckedAt={item.seenAt} sourceName={item.sourceName} />
          ) : (
            <span className={SMALL_PILL}>Kretopia</span>
          )}
          {item.origin === "external" ? (
            item.openUrl && (
              <Button asChild size="sm" variant="outline" className="min-h-11 sm:min-h-0">
                <a href={item.openUrl} target="_blank" rel={item.openRel} aria-label={`Apply at source: ${item.title}`}>
                  Apply at source <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </a>
              </Button>
            )
          ) : (
            <Button asChild size="sm" variant="outline" className="min-h-11 sm:min-h-0">
              <Link to={item.detailTo}>View gig</Link>
            </Button>
          )}
        </div>
      </ScoutGigCard>
    </li>
  );
}

/**
 * Scout's "All sources" tab: every gig from every source on one list, sorted into families (design, video, writing, engineering...), with
 * the counts printed next to each filter and the whole list one click away. Nothing is capped: a section outside the creative families
 * shows its first few until it is opened, and any search or filter shows every match.
 */
export function ScoutAllSources() {
  const { data, isLoading, isError } = useScoutCatalog();
  const scan = useOptionalScoutScan();
  const items = useMemo(() => includeScoutedGigs(data?.items ?? [], scan?.gigs ?? []), [data, scan?.gigs]);
  const [f, setF] = useState<CatalogFilters>(NO_FILTERS);
  const [opened, setOpened] = useState<Set<CategoryId>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fa = useMemo(() => facets(items, f), [items, f]);
  const shown = useMemo(() => filterCatalog(items, f), [items, f]);
  const sourceIds = useMemo(() => {
    const ids = new Map<string, string>();
    for (const i of items) ids.set(i.sourceId, i.sourceName);
    return [...ids.entries()].sort((a, b) => (a[0] === KRETOPIA_SOURCE ? -1 : b[0] === KRETOPIA_SOURCE ? 1 : a[1].localeCompare(b[1])));
  }, [items]);

  if (isLoading && items.length === 0) return <KretopiaLoader label="Loading every opportunity" size="sm" />;
  if (isError && items.length === 0) return <p className="text-sm text-muted-foreground">The opportunities could not be loaded right now. Try again in a moment.</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Search className="mb-2 h-4 w-4" aria-hidden />
        Nothing to list yet. Opportunities appear here after a curator has reviewed them against their original source.
      </div>
    );
  }

  const set = (patch: Partial<CatalogFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const active = filtersActive(f);
  const grouped = f.category === "all" ? groupByCategory(shown) : [{ id: f.category, items: shown }];
  const sourcesShown = new Set(shown.map((i) => i.sourceId)).size;

  const families: PillOption<CategoryId | "all">[] = [
    { id: "all", label: "All", count: fa.anyFamily },
    ...CATEGORIES.filter((c) => (fa.categories.get(c.id) ?? 0) > 0 || f.category === c.id).map((c) => ({ id: c.id, label: c.label, count: fa.categories.get(c.id) ?? 0 })),
  ];
  const works: PillOption<WorkMode | "all">[] = [
    { id: "all", label: "Any" },
    ...(["remote", "hybrid", "onsite", "unknown"] as WorkMode[]).filter((w) => (fa.workModes.get(w) ?? 0) > 0 || f.workMode === w).map((w) => ({ id: w, label: WORK_LABEL[w], count: fa.workModes.get(w) ?? 0 })),
  ];
  const levels: PillOption<Level | "all">[] = [
    { id: "all", label: "Any" },
    ...LEVELS.filter((l) => (fa.levels.get(l.id) ?? 0) > 0 || f.level === l.id).map((l) => ({ id: l.id, label: l.label, count: fa.levels.get(l.id) ?? 0 })),
  ];
  const langs: PillOption<Language | "all">[] = [
    { id: "all", label: "Any" },
    ...(["en", "de", "other"] as Language[]).filter((l) => (fa.languages.get(l) ?? 0) > 0 || f.language === l).map((l) => ({ id: l, label: LANG_LABEL[l], count: fa.languages.get(l) ?? 0 })),
  ];
  const dated = items.some((i) => i.sortAt > 0);
  const secondaryOn = [f.sources.length > 0, f.workMode !== "all", f.level !== "all", f.language !== "all", f.days > 0, f.payOnly].filter(Boolean).length;

  const toggleSource = (id: string) => set({ sources: f.sources.includes(id) ? f.sources.filter((s) => s !== id) : [...f.sources, id] });
  const toggleOpen = (id: CategoryId) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const kind = (id: CategoryId) => (categoryOf(id).group === "creative" ? "creative" : "other");
  const headings = grouped.map((g, i) => (f.category === "all" && (i === 0 || kind(g.id) !== kind(grouped[i - 1].id)) ? (kind(g.id) === "creative" ? "Creative fields" : "Other roles") : null));

  return (
    <div className="space-y-4" data-testid="scout-all-sources">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">Every opportunity, sorted</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Gigs from every source, newest first. Each one opens on the page that published it.
          </p>
        </div>
        <p className="text-xs font-semibold tabular-nums text-foreground" aria-live="polite" data-testid="catalog-count">
          {shown.length} {shown.length === 1 ? "opportunity" : "opportunities"} · {sourcesShown} {sourcesShown === 1 ? "source" : "sources"}
        </p>
      </div>

      {data?.partial && <p className="text-[11px] text-muted-foreground">Part of the list could not be loaded, so some opportunities may be missing.</p>}

      <div className="flex min-w-0 items-start gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search title, company or place"
          aria-label="Search opportunities"
          className="h-11 pl-9"
        />
      </div>



      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
      <PopoverTrigger asChild><Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5"
        aria-expanded={filtersOpen}
        aria-controls="scout-all-filters"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Filters{secondaryOn + (f.category !== "all" ? 1 : 0) > 0 ? ` · ${secondaryOn + (f.category !== "all" ? 1 : 0)}` : ""}
      </Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(440px,calc(100vw-32px))] max-h-[min(560px,70dvh)] overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Refine opportunities</h3><span className="text-xs tabular-nums text-muted-foreground">{shown.length} results</span></div>
      {filtersOpen && <Accordion type="single" collapsible id="scout-all-filters" className="border-y border-border">
        <AccordionItem value="field"><AccordionTrigger>Creative field{f.category !== "all" ? ` · ${categoryOf(f.category).label}` : ""}</AccordionTrigger><AccordionContent><Chips label="Field" options={families} isOn={(id) => f.category === id} onPick={(id) => set({ category: id })} /></AccordionContent></AccordionItem>
        <AccordionItem value="source"><AccordionTrigger>Sources{f.sources.length ? ` · ${f.sources.length}` : ""}</AccordionTrigger><AccordionContent>
        <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
          <div role="group" aria-label="Source" className={RAIL}>
            <Button variant="ghost" type="button" aria-pressed={f.sources.length === 0} onClick={() => set({ sources: [] })} className={cn(PILL_ITEM, f.sources.length === 0 && PILL_ITEM_ACTIVE)}>
              All
            </Button>
            {sourceIds.map(([id, name]) => (
              <Button variant="ghost" key={id} type="button" aria-pressed={f.sources.includes(id)} onClick={() => toggleSource(id)} className={cn(PILL_ITEM, f.sources.includes(id) && PILL_ITEM_ACTIVE)}>
                {name}
                <span className="tabular-nums text-[10px] opacity-70">{fa.sources.get(id) ?? 0}</span>
              </Button>
            ))}
          </div>
        </div>
        </AccordionContent></AccordionItem>
        <AccordionItem value="work"><AccordionTrigger>Work & experience</AccordionTrigger><AccordionContent className="space-y-3">
        {works.length > 2 && <Pills label="Work" options={works} isOn={(id) => f.workMode === id} onPick={(id) => set({ workMode: id })} />}
        {levels.length > 1 && (
          <div className="min-w-0 lg:col-span-2">
            <Pills label="Level" options={levels} isOn={(id) => f.level === id} onPick={(id) => set({ level: id })} />
          </div>
        )}
        </AccordionContent></AccordionItem>
        <AccordionItem value="details"><AccordionTrigger>Pay, language & freshness</AccordionTrigger><AccordionContent className="space-y-3">
        {dated && <Pills label="Posted" options={DAYS} isOn={(id) => f.days === id} onPick={(id) => set({ days: id })} />}
        {langs.length > 2 && <Pills label="Language" options={langs} isOn={(id) => f.language === id} onPick={(id) => set({ language: id })} />}
        {(fa.paid > 0 || f.payOnly) && (
          <Pills
            label="Pay"
            options={[
              { id: "any", label: "Any" },
              { id: "listed", label: "Pay listed", count: fa.paid },
            ]}
            isOn={(id) => (id === "listed") === f.payOnly}
            onPick={(id) => set({ payOnly: id === "listed" })}
          />
        )}
      </AccordionContent></AccordionItem></Accordion>}
      <div className="mt-3 flex items-center justify-between gap-2"><Button variant="ghost" size="sm" disabled={!active} onClick={() => setF(NO_FILTERS)}>Reset</Button><Button variant="secondary" size="sm" onClick={() => setFiltersOpen(false)}>Show {shown.length} results</Button></div>
      </PopoverContent></Popover>
      </div>

      {active && (
        <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1.5 sm:min-h-0" onClick={() => setF(NO_FILTERS)}>
          <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
        </Button>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground" data-testid="catalog-empty">
          No opportunity matches these filters. Clear a filter or two to see more.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g, gi) => {
            const def = categoryOf(g.id);
            const heading = headings[gi];
            const collapsible = def.group !== "creative" && !active && g.items.length > COLLAPSED_MAX;
            const open = !collapsible || opened.has(g.id);
            const list = open ? g.items : g.items.slice(0, COLLAPSED_MAX);
            return (
              <div key={g.id} className="space-y-3">
                {heading && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{heading}</p>}
                <section aria-labelledby={`family-${g.id}`} className="space-y-2">
                  <ScoutFieldCarousel label={def.label} heading={<h3 id={`family-${g.id}`} className="flex items-baseline gap-2 text-sm font-bold text-foreground">
                    {def.label}
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{g.items.length}</span>
                  </h3>}>
                    {list.map((it) => (
                      <OpportunityCard key={it.id} item={it} />
                    ))}
                  </ScoutFieldCarousel>
                  {collapsible && (
                    <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" aria-expanded={open} onClick={() => toggleOpen(g.id)}>
                      {open ? "Show fewer" : `Show all ${g.items.length}`}
                    </Button>
                  )}
                </section>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScoutAllSources;
