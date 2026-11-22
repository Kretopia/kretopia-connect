// Cookie and storage consent, per device. Two categories, matching what Kretopia actually uses:
//   essential  (always on): sign-in session, security, preferences, the app's offline cache
//   analytics  (optional):  first-party usage events (analytics_events), profile-view counts, deck metrics, and Sentry's masked
//                           session replay. No advertising or third-party marketing trackers exist, so none are offered.
// No stored choice (first visit, new device, cleared storage) means analytics stay off and the consent dialog opens.
const KEY = "kretopia:cookie-consent";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_CHANGED = "kretopia:cookie-consent-changed";
export const OPEN_COOKIE_SETTINGS = "kretopia:open-cookie-settings";

export interface CookieConsent {
  version: number;
  analytics: boolean;
  decidedAt: string;
}

// When storage is blocked (private mode), the choice still holds for this visit.
let memory: CookieConsent | null = null;

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CookieConsent;
      if (parsed?.version === COOKIE_CONSENT_VERSION && typeof parsed.analytics === "boolean") return parsed;
    }
  } catch { /* unreadable: fall back to this visit's choice */ }
  return memory;
}

export function saveCookieConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = { version: COOKIE_CONSENT_VERSION, analytics, decidedAt: new Date().toISOString() };
  memory = consent;
  try { localStorage.setItem(KEY, JSON.stringify(consent)); } catch { /* kept for this visit only */ }
  try { window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED, { detail: consent })); } catch { /* no window */ }
  return consent;
}

/** Optional measurement runs only after an explicit yes on this device. */
export const hasAnalyticsConsent = (): boolean => readCookieConsent()?.analytics === true;

/** Reopens the dialog (from the Privacy page or anywhere a "Cookie settings" link is shown). */
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));

/** Test helper: forgets the in-memory choice. */
export const __resetCookieConsentMemory = () => { memory = null; };
