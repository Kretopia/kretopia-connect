import { useEffect, useRef, type ReactNode } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventItem } from "@/pages/Events";

interface EventCalendarProps {
  events: EventItem[];
  month: Date;
  selectedDay: Date;
  onMonthChange: (month: Date) => void;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: EventItem) => void;
  renderEventCard: (event: EventItem, onClick: () => void) => ReactNode;
  onOpenFull?: () => void;
  full?: boolean;
}

export function EventCalendar({
  events,
  month,
  selectedDay,
  onMonthChange,
  onSelectDay,
  onSelectEvent,
  renderEventCard,
  onOpenFull,
  full = false,
}: EventCalendarProps) {
  const calendarRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    calendarRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  }, [month, selectedDay]);
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(month)),
  });
  const dayEvents = events.filter((event) => isSameDay(new Date(event.start_time), selectedDay));

  return (
    <section ref={calendarRef} className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Event availability calendar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMonthChange(subMonths(month, 1))} aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <h2 className="min-w-[9rem] text-center text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
          <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
        {!full && onOpenFull && (
          <button type="button" onClick={onOpenFull} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Full calendar
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${format(month, "MMMM yyyy")} dates`}>
        {days.map((day) => {
          const count = events.filter((event) => isSameDay(new Date(event.start_time), day)).length;
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-label={`${format(day, "EEEE, MMMM d")}${count ? `, ${count} event${count === 1 ? "" : "s"}` : ", no events"}`}
              data-date={format(day, "yyyy-MM-dd")}
              aria-pressed={isSameDay(day, selectedDay)}
              onClick={() => onSelectDay(day)}
              onKeyDown={(event) => {
                const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
                if (!delta) return;
                event.preventDefault();
                const next = new Date(day);
                next.setDate(next.getDate() + delta);
                pendingFocus.current = format(next, "yyyy-MM-dd");
                if (!isSameMonth(next, month)) onMonthChange(startOfMonth(next));
                onSelectDay(next);
              }}
              className={`relative min-h-10 rounded-lg text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSameDay(day, selectedDay) ? "bg-primary font-semibold text-primary-foreground" : isSameMonth(day, month) ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {format(day, "d")}
              {count > 0 && <span aria-hidden className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSameDay(day, selectedDay) ? "bg-primary-foreground" : "bg-primary"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold">{format(selectedDay, "EEEE, MMMM d")}</h3>
        {dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dayEvents.map((event) => renderEventCard(event, () => onSelectEvent(event)))}
          </div>
        )}
      </div>
    </section>
  );
}

export default EventCalendar;
