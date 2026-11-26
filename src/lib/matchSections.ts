// Match's two top-level sections, and the one that holds a second, in-tab view: Browse (the swipe deck, or the
// searchable grid) and Connected (people already connected). "Directory", "Interested" and "Sent interests" are not
// sections any more: the Grid is where people are searched, Connected is the accepted connections. Pure and
// dependency-free, so the URL/legacy-param resolution is unit-testable without mounting the page.

export const MATCH_TAB_IDS = ["browse", "connected"] as const;
export type MatchTabId = (typeof MATCH_TAB_IDS)[number];

export const BROWSE_VIEW_IDS = { deck: "deck", grid: "grid" } as const;
export type BrowseViewId = (typeof BROWSE_VIEW_IDS)[keyof typeof BROWSE_VIEW_IDS];

export const CONNECTED_VIEW_IDS = { connected: "connected" } as const;
export type ConnectedViewId = (typeof CONNECTED_VIEW_IDS)[keyof typeof CONNECTED_VIEW_IDS];

/** A tab/view pair that is always valid: a real tab id, and a view that belongs to it. */
export interface MatchSection {
  tab: MatchTabId;
  view: string;
}

const DEFAULT_VIEW: Record<MatchTabId, string> = {
  browse: BROWSE_VIEW_IDS.deck,
  connected: CONNECTED_VIEW_IDS.connected,
};

/**
 * Where a retired section's address lands now, so a bookmark, a shared link or an old redirect still opens something useful:
 *   - `tab=discover`   (the old deck tab)       -> browse / deck
 *   - `tab=directory`  (the Passport directory) -> browse / grid, where people are searched (a `q` in the URL fills the Grid's search)
 *   - `tab=interested` (the old likes-you tab)  -> connected
 *   - `view=interested` / `view=sent` inside Connected -> connected (the default view, by the rule below)
 */
const RETIRED_TABS: Readonly<Record<string, MatchSection>> = {
  discover: { tab: "browse", view: BROWSE_VIEW_IDS.deck },
  directory: { tab: "browse", view: BROWSE_VIEW_IDS.grid },
  interested: { tab: "connected", view: CONNECTED_VIEW_IDS.connected },
};

/**
 * Resolves the page's two query params (`tab`, `view`) into a valid section, falling back to Browse/Deck -- the
 * same place a bare `/match` has always landed. An unknown tab, or a view that does not belong to the resolved tab,
 * falls back to that tab's default view rather than carrying over a stale one.
 */
export function matchTabFromParams(tabParam: string | null, viewParam: string | null): MatchSection {
  const retired = tabParam ? RETIRED_TABS[tabParam] : undefined;
  if (retired) return retired;

  const tab: MatchTabId = (MATCH_TAB_IDS as readonly string[]).includes(tabParam ?? "") ? (tabParam as MatchTabId) : "browse";
  const validViews: Record<MatchTabId, readonly string[]> = {
    browse: Object.values(BROWSE_VIEW_IDS),
    connected: Object.values(CONNECTED_VIEW_IDS),
  };
  const view = viewParam && validViews[tab].includes(viewParam) ? viewParam : DEFAULT_VIEW[tab];
  return { tab, view };
}
