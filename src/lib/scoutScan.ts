/**
 * Scout scan helpers: when to refresh on its own, and what to tell the person
 * about a scan. Kept out of the component so the wording and the timing rules
 * can be tested.
 */

/** Scout re-checks the public job boards on its own when the last check is older than this. */
export const LIVE_STALE_MS = 30 * 60_000;
/** While Scout stays open it checks again this often (the boards update about hourly). */
export const LIVE_INTERVAL_MS = 10 * 60_000;

export const isScanStale = (lastRunAt: string | null | undefined, now: number = Date.now(), maxAgeMs: number = LIVE_STALE_MS): boolean => {
  if (!lastRunAt) return true;
  const t = Date.parse(lastRunAt);
  return !Number.isFinite(t) || now - t > maxAgeMs;
};

export interface ScanResult {
  ok?: boolean;
  gated?: boolean;
  skipped?: string;
  message?: string;
  found?: number;
  filtered?: number;
  inserted?: number;
  queries?: number;
  degraded?: string[];
}

/**
 * The edge function's own error text, as something a person can act on.
 * Older deployments answer HTTP 500 {"error":"Scout not configured"} when the
 * web-search or AI key is missing; that is a workspace setting, not the user's
 * fault, and the open gigs on Kretopia are still there.
 */
export const friendlyScanError = (detail: string | null | undefined): string => {
  const text = (detail ?? "").trim();
  if (!text) return "The scan could not complete. Try again in a moment.";
  if (/not configured/i.test(text)) {
    return "Scout's web search isn't switched on for this workspace yet. Open gigs on Kretopia are still listed below.";
  }
  if (/unauthori[sz]ed|forbidden|invalid session/i.test(text)) return "Sign in again to run Scout.";
  if (/daily limit/i.test(text)) return text;
  if (/^\s*[{[]/.test(text)) return "The scan could not complete. Try again in a moment."; // never show raw JSON
  return text;
};

/** A short, honest line about what a degraded scan could not use, or null. */
export const degradedNote = (degraded: string[] | undefined): string | null => {
  if (!degraded?.length) return null;
  if (degraded.includes("feeds_unavailable")) {
    return "The job boards didn't answer just now. Showing what Scout already found; try again in a few minutes.";
  }
  if (degraded.includes("web_search_unavailable")) {
    return "Scout checked the remote job boards. Wider web search (gig sites, LinkedIn, Instagram) isn't switched on for this workspace.";
  }
  return null;
};

/** What to tell the person after a scan, or null when it is not worth interrupting them. */
export const describeScan = (data: ScanResult | null | undefined, auto: boolean): { title: string; description?: string } | null => {
  if (!data || data.skipped) return null;
  if (data.gated) return data.message ? { title: data.message } : null;
  const filtered = data.filtered ?? data.found ?? 0;
  const inserted = data.inserted ?? 0;
  if (inserted > 0) {
    return {
      title: `Found ${inserted} new gig${inserted === 1 ? "" : "s"}`,
      description: `Matched ${filtered} across ${data.queries || 0} sources — ${inserted} weren't already in your list.`,
    };
  }
  if (auto) return null; // nothing new on an automatic scan is not news
  if (filtered > 0) return { title: "No new gigs", description: `Matched ${filtered} gigs, but you've already seen all of them.` };
  return { title: "No fresh gigs matched right now", description: "Try again later, or widen your sources under Tune." };
};
