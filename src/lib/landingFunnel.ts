/**
 * landingFunnel — instrumentation for the guest landing page.
 *
 * Before this existed the landing page emitted almost nothing: a handful of
 * `cta_click` events from two chapter buttons and nothing about how far a
 * visitor actually got. That made it impossible to tell "the copy didn't
 * land" apart from "the CTA was never seen".
 *
 * Everything here writes to the existing `analytics_events` table through the
 * shared `trackEvent` helper (anon insert allowed, admin-only read). No new
 * table, no schema change — `event_properties` carries the section / cta /
 * depth detail.
 *
 * All calls are fire-and-forget and never throw.
 */
import { trackEvent, EventCategory } from "@/lib/analytics";

/** Sections we care about, in page order. Keep in sync with the ids used on
 *  the landing sections themselves — the tracker reads real DOM ids, this
 *  list only drives ordering in the admin funnel view. */
export const LANDING_SECTION_ORDER = [
  "kretopia-hero",
  "chapter-loop",
  "inline-signup",
  "chapter-passport",
  "chapter-verified-credits",
  "chapter-scout",
  "chapter-match",
  "chapter-studio",
  "chapter-kreto",
  "chapter-community",
  "chapter-organisations",
  "closing-cta",
  "faq",
] as const;

export const trackLandingSectionViewed = (section: string, index = -1) =>
  trackEvent({
    eventName: "landing_section_viewed",
    eventCategory: EventCategory.ENGAGEMENT,
    properties: { section, index },
  });

export const trackLandingScrollDepth = (depth: 25 | 50 | 75 | 100) =>
  trackEvent({
    eventName: "landing_scroll_depth",
    eventCategory: EventCategory.ENGAGEMENT,
    properties: { depth },
  });

/**
 * Landing CTA click. Deliberately emits the same `cta_click` event name the
 * rest of the app already uses so existing dashboards keep working, with the
 * extra `section` / `variant` detail the funnel view needs.
 */
export const trackLandingCta = (
  ctaId: string,
  section: string,
  extra: Record<string, unknown> = {},
) =>
  trackEvent({
    eventName: "cta_click",
    eventCategory: EventCategory.ENGAGEMENT,
    properties: { cta_name: ctaId, cta_id: ctaId, location: section, section, ...extra },
  });
