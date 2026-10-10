import { CalendarClock, MapPin, Video } from "lucide-react";

import { MediaImage } from "@/components/media/MediaImage";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { OutlineCta } from "@/components/ui/glass-cta";
import { formatEventWhen, type NextEvent } from "@/lib/nextEvent";
import { startsIn } from "./radar.logic";

/**
 * "Your next event": the one event that is coming up for this person (hosted or
 * going), with its real cover. With no cover of its own it shows a Kreto robot
 * on the brand surface (never a made-up picture), and with no event at all it
 * says so and points to where events are.
 */
function EventArt() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[hsl(var(--energy)/0.2)] via-muted to-card">
      <KretoCharacter variant="director" size={120} floatAmplitude={0} lazy />
    </div>
  );
}

export function RadarLead({ event }: { event: NextEvent | null }) {
  if (!event) {
    return (
      <section aria-label="Your next event" className="flex min-h-[148px] items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your next event</p>
          <p className="mt-2 text-base font-semibold text-foreground">Nothing on your calendar yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Pick one below, or host your own.</p>
        </div>
        <OutlineCta to="/meetup" size="sm" className="min-h-11 shrink-0">Browse events</OutlineCta>
      </section>
    );
  }

  const online = /online|virtual/i.test(event.event_mode ?? "");
  const where = event.venue_name || (online ? "Online" : null);
  const soon = startsIn(event.start_time);

  return (
    <section aria-label="Your next event" className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <MediaImage
        src={event.cover_image_url}
        alt={`Cover of ${event.title}`}
        aspect="aspect-[16/9] sm:aspect-auto"
        className="sm:min-h-[11rem]"
        fallback={<EventArt />}
      />
      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your next event</p>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
            {event.role === "hosting" ? "Hosting" : "Going"}
          </span>
          {soon && <span className="text-[11px] font-semibold text-[hsl(var(--energy))]">{soon}</span>}
        </div>
        <h3 className="line-clamp-2 break-words text-xl font-bold leading-tight text-foreground">{event.title}</h3>
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

export default RadarLead;
