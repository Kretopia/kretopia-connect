import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPin, Video } from "lucide-react";

import kretoEventArt from "@/assets/brand/kreto/kreto-director-mic.png";
import { supabase } from "@/integrations/supabase/client";
import { MediaImage } from "@/components/media/MediaImage";
import { OutlineCta } from "@/components/ui/glass-cta";
import { useAuth } from "@/hooks/useAuth";
import { formatEventWhen, pickNextEvent, type EventRow, type NextEvent } from "@/lib/nextEvent";

const EVENT_COLUMNS = "id, title, start_time, end_time, venue_name, category, cover_image_url, event_mode, status";

/**
 * The person's own next event: what they host or have said they are going to.
 * Two small reads (limit 5 and 50 ids), cached, and nothing for anyone else's
 * private events: both reads are scoped to this user's own rows.
 */
async function fetchNextEvent(userId: string): Promise<NextEvent | null> {
  const nowIso = new Date().toISOString();
  const [hosted, going] = await Promise.all([
    supabase
      .from("creative_jams")
      .select(EVENT_COLUMNS)
      .eq("created_by", userId)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(5),
    supabase.from("jam_participants").select("jam_id").eq("user_id", userId).eq("status", "going").limit(50),
  ]);

  const ids = ((going.data as Array<{ jam_id: string }> | null) ?? []).map((r) => r.jam_id);
  let attending: EventRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("creative_jams")
      .select(EVENT_COLUMNS)
      .in("id", ids)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(5);
    attending = (data as unknown as EventRow[] | null) ?? [];
  }
  return pickNextEvent((hosted.data as unknown as EventRow[] | null) ?? [], attending);
}

/**
 * Event with no cover of its own: Kreto on the brand surface. Kreto is the
 * stand-in for "an event has been set up" only; it never replaces a real cover.
 */
function EventFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[hsl(var(--energy)/0.2)] via-muted to-card">
      <img
        src={kretoEventArt}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-[78%] w-auto max-w-[70%] object-contain"
      />
    </div>
  );
}

/** After the decision cards: the one event that is actually coming up for this person. Nothing when there is none. */
export function TodayNextEvent() {
  const { user } = useAuth();
  const { data: event } = useQuery({
    queryKey: ["today-next-event", user?.id],
    queryFn: () => fetchNextEvent(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  if (!event) return null;

  const online = /online|virtual/i.test(event.event_mode ?? "");
  const where = event.venue_name || (online ? "Online" : null);

  return (
    <section
      aria-label="Your next event"
      className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <MediaImage
        src={event.cover_image_url}
        alt={`Cover of ${event.title}`}
        aspect="aspect-[16/9] sm:aspect-auto"
        className="sm:min-h-[11rem]"
        fallback={<EventFallback />}
      />
      <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your next event</p>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
            {event.role === "hosting" ? "Hosting" : "Going"}
          </span>
        </div>
        <h2 className="line-clamp-2 break-words text-xl font-bold leading-tight text-foreground">{event.title}</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span>{formatEventWhen(event.start_time)}</span>
          </li>
          {where && (
            <li className="flex min-w-0 items-center gap-2">
              {event.venue_name ? <MapPin className="h-4 w-4 shrink-0" aria-hidden /> : <Video className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="truncate">{where}</span>
            </li>
          )}
        </ul>
        <OutlineCta to={`/event/${event.id}`} className="mt-auto min-h-11 w-full sm:w-fit">
          Open event
        </OutlineCta>
      </div>
    </section>
  );
}

export default TodayNextEvent;
