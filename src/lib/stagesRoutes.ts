// Which view of the one Stages component a URL asks for, and where the old /circle tab links now land.
// Every route that used to be its own page (/circle, /soundstages, a curated stage, the speed nights, the event
// backstage) still exists and still resolves here, so no saved or shared link stops working.

export type StagesView = "sound" | "curated" | "speed" | "speed-session" | "speed-recap" | "backstage";

export function stagesViewFor(pathname: string): StagesView {
  if (pathname === "/events/backstage" || pathname.startsWith("/events/backstage/")) return "backstage";
  if (/^\/circle\/speed\/[^/]+\/recap\/?$/.test(pathname)) return "speed-recap";
  if (/^\/circle\/speed\/[^/]+\/?$/.test(pathname)) return "speed-session";
  if (pathname === "/circle/speed" || pathname === "/circle/speed/") return "speed";
  if (pathname.startsWith("/circle/stage/")) return "curated";
  return "sound";
}

/**
 * /circle used to switch between Stages, Match, Browse and Network. Match and Browse are Match's own tabs and the
 * accepted-connections list is Match's "Connected" tab, so those three values hand over to /match with every other
 * query parameter kept (a shared ?join= or a welcome handoff must not be lost). Any other value stays on Stages.
 */
export function legacyTabTarget(search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const welcome = params.get("welcome") === "match";
  const target = tab === "match" || welcome ? "discover" : tab === "browse" ? "browse" : tab === "network" ? "connected" : null;
  if (!target) return null;
  const next = new URLSearchParams(params);
  next.set("tab", target);
  return `/match?${next.toString()}`;
}
