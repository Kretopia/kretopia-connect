import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface EventsTabProps {
  events: any[];
  isMember: boolean;
  onCreateEvent: () => void;
}

export function CircleEventsTab({ events, isMember, onCreateEvent }: EventsTabProps) {
  const navigate = useNavigate();
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start_time) >= now);
  const past = events.filter(e => new Date(e.start_time) < now);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        eyebrow="Bring people together"
        title="No events yet"
        description="Host a meetup, jam, or workshop. Members get notified the moment you publish."
        action={isMember ? { label: "Host your first event", icon: Plus, onClick: onCreateEvent } : undefined}
      />
    );
  }

  const renderCard = (ev: any, isPast = false) => (
    <button
      key={ev.id}
      onClick={() => navigate(`/event/${ev.id}`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
    >
      <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center shrink-0 ${isPast ? "bg-muted" : "bg-primary/10"}`}>
        <span className={`text-[9px] font-bold uppercase ${isPast ? "text-muted-foreground" : "text-primary"}`}>
          {new Date(ev.start_time).toLocaleDateString(undefined, { month: "short" })}
        </span>
        <span className={`text-lg font-black leading-none ${isPast ? "text-muted-foreground" : "text-primary"}`}>
          {new Date(ev.start_time).getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{ev.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span>
            {new Date(ev.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
          {ev.venue_name && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" />{ev.venue_name}
              </span>
            </>
          )}
        </div>
      </div>
      {ev.status && ev.status !== "scheduled" && (
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 capitalize">{ev.status}</Badge>
      )}
    </button>
  );

  return (
    <div className="px-4 pb-8 space-y-6">
      {isMember && (
        <Button variant="gradient" className="w-full" onClick={onCreateEvent}>
          <Plus className="h-4 w-4 mr-1.5" /> Create Event
        </Button>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Upcoming · {upcoming.length}
          </h2>
          <div className="space-y-2">{upcoming.map(ev => renderCard(ev, false))}</div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Past · {past.length}
          </h2>
          <div className="space-y-2 opacity-75">{past.map(ev => renderCard(ev, true))}</div>
        </section>
      )}
    </div>
  );
}
