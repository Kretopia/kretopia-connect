// Deck-grade instrumentation helper.
// Writes to public.analytics_events (allows anon+authed insert, admin-only read).
// All calls are best-effort and never throw.
import { supabase } from "@/integrations/supabase/client";

export type DeckEventCategory =
  | "passport"
  | "opportunity"
  | "agent"
  | "share"
  | "money"
  | "speed";

export async function trackDeckEvent(
  event_name: string,
  event_category: DeckEventCategory,
  event_properties: Record<string, unknown> = {},
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("analytics_events").insert([{
      user_id: user?.id ?? undefined,
      event_name,
      event_category,
      event_properties: event_properties as never,
      page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
      referrer: typeof document !== "undefined" ? (document.referrer || undefined) : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }]);
  } catch {
    /* silent */
  }
}
