import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight, privacy-respecting platform analytics.
 * Writes to public.site_analytics with scope='platform'.
 *
 * - Visitor ID: persistent across sessions (localStorage)
 * - Session ID: 30-min inactivity window
 * - Bounce: a session with exactly 1 pageview AND duration < 10s
 * - Time on page: measured on visibilitychange/pagehide via sendBeacon
 * - Filters Lovable preview, bots, headless browsers, admin routes
 * - Attaches user_id when an auth session is present
 */

const VISITOR_KEY = "_ti_vid";
const SESSION_KEY = "_ti_sid";
const SESSION_TS_KEY = "_ti_sid_ts";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// ---- environment / bot filters --------------------------------------------
const isPreviewOrBot = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const host = window.location.hostname.toLowerCase();
    if (
      host.includes("lovable.app") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.dev") ||
      host === "localhost" ||
      host.startsWith("127.") ||
      host.endsWith(".local")
    ) {
      return true;
    }
    // @ts-ignore
    if (navigator.webdriver) return true;
    const ua = navigator.userAgent.toLowerCase();
    if (
      /bot|crawl|spider|slurp|bingpreview|headlesschrome|puppeteer|playwright|lighthouse|prerender/i.test(
        ua
      )
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
};

const isExcludedPath = (path: string): boolean =>
  path.startsWith("/admin") || path.startsWith("/__");

const getDeviceType = (): string => {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
};

const getVisitorId = (): string => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

const getSessionId = (): string => {
  try {
    const now = Date.now();
    const lastTs = Number(sessionStorage.getItem(SESSION_TS_KEY) || 0);
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid || now - lastTs > SESSION_TIMEOUT_MS) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return sid;
  } catch {
    return crypto.randomUUID();
  }
};

// ---- user_id cache (refreshed on auth state change) -----------------------
let cachedUserId: string | null = null;
let userIdInitialized = false;

const ensureUserId = async (): Promise<string | null> => {
  if (userIdInitialized) return cachedUserId;
  userIdInitialized = true;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
    supabase.auth.onAuthStateChange((_evt, session) => {
      cachedUserId = session?.user?.id ?? null;
    });
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
};

// ---- duration measurement -------------------------------------------------
let currentPath: string | null = null;
let pageStartTs = 0;
let durationFlushed = false;

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  `https://${(import.meta as any).env?.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Send via sendBeacon (preferred on pagehide/visibilitychange) with a
 * keepalive fetch fallback. Both survive page unload.
 */
const beaconInsert = (row: Record<string, unknown>) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const url = `${SUPABASE_URL}/rest/v1/site_analytics`;
  const body = JSON.stringify(row);
  try {
    // NOTE: navigator.sendBeacon always sends with credentials mode "include",
    // which CORS rejects against PostgREST's wildcard Access-Control-Allow-Origin.
    // Use a keepalive fetch with credentials omitted instead — it also survives
    // page unload and lets us pass the apikey as a header rather than a query param.
    void fetch(url, {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body,
    }).catch(() => {});
  } catch {
    /* silent */
  }
};

const flushPageDuration = (useBeacon = false) => {
  if (!currentPath || durationFlushed) return;
  durationFlushed = true;
  const duration = Date.now() - pageStartTs;
  const sessionId = getSessionId();
  const row = {
    scope: "platform",
    event_type: "duration",
    visitor_id: getVisitorId(),
    session_id: sessionId,
    page_path: currentPath,
    duration_ms: duration,
    device_type: getDeviceType(),
    user_id: cachedUserId,
  };
  if (useBeacon) {
    beaconInsert(row);
  } else {
    supabase.from("site_analytics").insert(row as any).then(
      () => {},
      () => {}
    );
  }
};

export const trackPlatformPageview = async (path: string) => {
  if (isPreviewOrBot()) return;
  if (isExcludedPath(path)) return;

  // Flush previous page's duration before starting a new one
  if (currentPath && currentPath !== path) {
    flushPageDuration(false);
  }

  currentPath = path;
  pageStartTs = Date.now();
  durationFlushed = false;

  await ensureUserId();
  const sessionId = getSessionId();
  try {
    await supabase.from("site_analytics").insert({
      scope: "platform",
      event_type: "view",
      visitor_id: getVisitorId(),
      session_id: sessionId,
      page_path: path,
      referrer: document.referrer || null,
      device_type: getDeviceType(),
      user_id: cachedUserId,
    } as any);
  } catch {
    /* silent */
  }
};

let listenersAttached = false;

export const attachPlatformAnalyticsListeners = () => {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  void ensureUserId();

  // visibilitychange = hidden  → flush via beacon (survives backgrounding)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPageDuration(true);
  });
  // pagehide  → flush via beacon (survives navigation/close)
  window.addEventListener("pagehide", () => flushPageDuration(true));
  // beforeunload fallback (some browsers skip pagehide)
  window.addEventListener("beforeunload", () => flushPageDuration(true));
};
