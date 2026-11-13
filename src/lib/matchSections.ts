// Match's three top-level sections, and the two that hold a second, in-tab view instead of being a tab of their
// own: Browse (the swipe deck, or the filterable grid) and Connected (accepted connections, or who is interested
// in you). Both used to be separate top-level tabs ("Discover" and "Interested"); they are each two views of one
// kind of thing now -- Browse is "find people", Connected is "people already found" -- so they live as a
// SegmentToggle inside the tab that owns them, not a tab of their own. Pure and dependency-free (icons are values
// here, never rendered), so the URL/legacy-param resolution is unit-testable without mounting the page.
import { LayoutGrid, Sparkles, UserCheck, Users } from "lucide-react";

export const MATCH_TAB_IDS = ["browse", "directory", "connected"] as const;
export type MatchTabId = (typeof MATCH_TAB_IDS)[number];

export const BROWSE_VIEW_IDS = { deck: "deck", grid: "grid" } as const;
export type BrowseViewId = (typeof BROWSE_VIEW_IDS)[keyof typeof BROWSE_VIEW_IDS];

export const CONNECTED_VIEW_IDS = { connected: "connected", interested: "interested" } as const;
export type ConnectedViewId = (typeof CONNECTED_VIEW_IDS)[keyof typeof CONNECTED_VIEW_IDS];

export const BROWSE_SEGMENT_OPTIONS = [
  { value: BROWSE_VIEW_IDS.deck, label: "Deck", icon: Sparkles },
  { value: BROWSE_VIEW_IDS.grid, label: "Grid", icon: LayoutGrid },
] as const;

export const CONNECTED_SEGMENT_OPTIONS = [
  { value: CONNECTED_VIEW_IDS.connected, label: "Connected", icon: UserCheck },
  { value: CONNECTED_VIEW_IDS.interested, label: "Interested", icon: Users },
] as const;

/** A tab/view pair that is always valid: a real tab id, and a view that belongs to it (or "" for Directory, which has none). */
export interface MatchSection {
  tab: MatchTabId;
  view: string;
}

const DEFAULT_VIEW: Record<MatchTabId, string> = {
  browse: BROWSE_VIEW_IDS.deck,
  directory: "",
  connected: CONNECTED_VIEW_IDS.connected,
};

/**
 * Resolves the page's two query params (`tab`, `view`) into a valid section, falling back to Browse/Deck -- the
 * same place a bare `/match` landed before the merge. Two old top-level tab ids are still honoured, so a
 * bookmark or a link written before this change still opens the same content it used to:
 *   - `tab=discover` (the old deck tab)      -> browse / deck
 *   - `tab=interested` (the old likes-you tab) -> connected / interested
 * An unknown tab, or a view that does not belong to the resolved tab, falls back to that tab's default view
 * rather than carrying over a stale one (e.g. `tab=directory&view=grid` -> directory / "").
 */
export function matchTabFromParams(tabParam: string | null, viewParam: string | null): MatchSection {
  const legacy: Partial<Record<string, MatchSection>> = {
    discover: { tab: "browse", view: BROWSE_VIEW_IDS.deck },
    interested: { tab: "connected", view: CONNECTED_VIEW_IDS.interested },
  };
  if (tabParam && legacy[tabParam]) return legacy[tabParam]!;

  const tab: MatchTabId = (MATCH_TAB_IDS as readonly string[]).includes(tabParam ?? "") ? (tabParam as MatchTabId) : "browse";
  const validViews: Record<MatchTabId, readonly string[]> = {
    browse: Object.values(BROWSE_VIEW_IDS),
    directory: [],
    connected: Object.values(CONNECTED_VIEW_IDS),
  };
  const view = viewParam && validViews[tab].includes(viewParam) ? viewParam : DEFAULT_VIEW[tab];
  return { tab, view };
}
