import { lazy, Suspense, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { CalendarDays, Clock3, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { downloadIcs } from "@/lib/eventActions";
import { APP_URL } from "@/lib/constants";
import type { EventItem } from "@/pages/Events";

const LazyEventCalendar = lazy(() => import("@/components/sessions/EventCalendar"));

type CalendarEvent = Pick<EventItem, "id" | "title" | "start_time" | "end_time" | "venue_name" | "venue_address" | "category" | "max_participants" | "participant_count" | "creator_name" | "created_by" | "description" | "is_ticketed" | "ticket_price" | "ticket_currency" | "event_mode" | "status">;

interface EventCalendarWorkspaceProps {
  event: CalendarEvent;
  userId: string | null;
  participation: string | null;
  bookingDisabled: boolean;
  bookingReason: string | null;
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
  returnFocusRef: MutableRefObject<HTMLElement | null>;
  onBook: () => void;
}

type CalendarView = "agenda" | "week" | "month";
type CalendarFilter = "all" | "booked" | "this-event";

const asEventItem = (event: CalendarEvent): EventItem => ({
  ...event,
  category: event.category || "general",
  max_participants: event.max_participants || 0,
  participant_count: event.participant_count || 0,
  creator_name: event.creator_name || "Event host",
  created_by: event.created_by || "",
});

export function EventCalendarWorkspace({
  event,
  userId,
  participation,
  bookingDisabled,
  bookingReason,
  calendarOpen,
  onCalendarOpenChange,
  returnFocusRef,
  onBook,
}: EventCalendarWorkspaceProps) {
  const activeEvent = useMemo(() => asEventItem(event), [event]);
  const [bookedEvents, setBookedEvents] = useState<EventItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [selectedDay, setSelectedDay] = useState(() => new Date(event.start_time));
  const [month, setMonth] = useState(() => new Date(event.start_time));
  const [calendarTab, setCalendarTab] = useState("calendar");
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<EventItem>(activeEvent);

  useEffect(() => {
    setSelectedDay(new Date(event.start_time));
    setMonth(new Date(event.start_time));
    setSelectedCalendarEvent(activeEvent);
  }, [activeEvent, event.id, event.start_time]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setBookedEvents([]);
      setBookingsError(null);
      setBookingsLoading(false);
      return () => { active = false; };
    }

    const loadBookings = async () => {
      setBookingsLoading(true);
      setBookingsError(null);
      try {
        const { data: reservations, error: reservationError } = await supabase
          .from("jam_participants")
          .select("jam_id")
          .eq("user_id", userId)
          .eq("status", "going");
        if (reservationError) throw reservationError;
        const ids = [...new Set((reservations || []).map((row) => row.jam_id).filter((id): id is string => !!id))];
        if (!ids.length) {
          if (active) setBookedEvents([]);
          return;
        }
        const { data, error } = await supabase
          .from("creative_jams")
          .select("id, title, start_time, end_time, venue_name, venue_address, category, max_participants, created_by, description, is_ticketed, ticket_price, ticket_currency, event_mode, status")
          .in("id", ids);
        if (error) throw error;
        if (active) {
          setBookedEvents((data || []).map((row) => asEventItem({
            ...row,
            participant_count: 0,
            creator_name: "Event host",
          })));
        }
      } catch (error) {
        if (active) setBookingsError(error instanceof Error ? error.message : "Your booked events could not be loaded.");
      } finally {
        if (active) setBookingsLoading(false);
      }
    };

    void loadBookings();
    return () => { active = false; };
  }, [userId, participation]);

  const allEvents = useMemo(() => {
    const byId = new Map<string, EventItem>(bookedEvents.map((item) => [item.id, item]));
    byId.set(activeEvent.id, activeEvent);
    return [...byId.values()].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  }, [activeEvent, bookedEvents]);
  const filteredEvents = useMemo(() => {
    if (filter === "booked") return allEvents.filter((item) => item.id !== activeEvent.id || participation === "going");
    if (filter === "this-event") return [activeEvent];
    return allEvents;
  }, [activeEvent, allEvents, filter, participation]);
  const suggestions = useMemo(() => {
    const timed = allEvents
      .map((item) => ({ item, start: Date.parse(item.start_time), end: Date.parse(item.end_time || item.start_time) }))
      .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end))
      .sort((a, b) => a.start - b.start);
    const notes: string[] = [];
    for (let index = 1; index < timed.length; index += 1) {
      const previous = timed[index - 1];
      const current = timed[index];
      if (current.start < previous.end) {
        notes.push(`Check the overlap between “${previous.item.title}” and “${current.item.title}”.`);
      } else if (current.start - previous.end >= 60 * 60 * 1000 && isSameDay(new Date(previous.start), new Date(current.start))) {
        notes.push(`Keep a break between “${previous.item.title}” and “${current.item.title}”.`);
      }
    }
    const upcoming = timed.find((item) => item.item.id === activeEvent.id && item.start > Date.now());
    if (upcoming && upcoming.start - Date.now() >= 30 * 60 * 1000) {
      notes.push(`A 30-minute prep block before “${activeEvent.title}” may help.`);
    }
    return notes;
  }, [activeEvent, allEvents]);

  const renderEventCard = (item: EventItem, onClick: () => void) => (
    <button
      key={item.id}
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block font-semibold">{item.title}</span>
      <span className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 className="h-4 w-4" aria-hidden />
        {format(new Date(item.start_time), "p")} · {item.venue_name || "Online or location TBA"}
      </span>
    </button>
  );

  const renderMonthCalendar = (items: EventItem[], full = false) => (
    <Suspense fallback={<div className="flex min-h-40 items-center justify-center"><KretopiaSpinner /></div>}>
      <LazyEventCalendar
        events={items}
        month={month}
        selectedDay={selectedDay}
        onMonthChange={setMonth}
        onSelectDay={setSelectedDay}
        onSelectEvent={(selected) => {
          setSelectedCalendarEvent(selected);
          if (!full) openCalendar();
        }}
        renderEventCard={renderEventCard}
        full={full}
      />
    </Suspense>
  );

  const selectEventInModal = (item: EventItem) => {
    setSelectedCalendarEvent(item);
    setSelectedDay(new Date(item.start_time));
    setMonth(new Date(item.start_time));
  };

  const downloadEvent = (item: EventItem) => downloadIcs({
    id: item.id,
    title: item.title,
    description: item.description,
    startTime: item.start_time,
    endTime: item.end_time,
    venueName: item.venue_name,
    venueAddress: item.venue_address,
    url: `${APP_URL}/event/${item.id}`,
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDay),
    end: endOfWeek(selectedDay),
  });

  const openCalendar = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onCalendarOpenChange(true);
  };

  return (
    <>
      <section id="schedule" className="scroll-mt-24 space-y-4" aria-labelledby="event-schedule-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Your event calendar</p>
            <h2 id="event-schedule-heading" className="text-2xl font-semibold">Schedule</h2>
          </div>
          <Button type="button" variant="outline" onClick={openCalendar}>
            <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
            Open calendar
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Calendar view">
                {(["agenda", "week", "month"] as const).map((value) => (
                  <Button key={value} type="button" size="sm" variant={view === value ? "default" : "outline"} aria-pressed={view === value} onClick={() => setView(value)}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <select
                  aria-label="Filter calendar events"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as CalendarFilter)}
                  className="min-h-10 rounded-lg border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All events</option>
                  <option value="booked">My bookings</option>
                  <option value="this-event">This event</option>
                </select>
              </label>
            </div>

            {view === "month" ? renderMonthCalendar(filteredEvents) : view === "agenda" ? (
              filteredEvents.length ? (
                <div className="grid gap-3 sm:grid-cols-2">{filteredEvents.map((item) => renderEventCard(item, () => selectEventInModal(item)))}</div>
              ) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No events match this view.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {weekDays.map((day) => {
                  const dayEvents = filteredEvents.filter((item) => isSameDay(new Date(item.start_time), day));
                  return (
                    <div key={day.toISOString()} className="min-w-0 rounded-xl border border-border p-3">
                      <h3 className="mb-2 font-semibold">{format(day, "EEE, MMM d")}</h3>
                      {dayEvents.length ? <div className="space-y-2">{dayEvents.map((item) => renderEventCard(item, () => selectEventInModal(item)))}</div> : <p className="text-sm text-muted-foreground">No events</p>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-border pt-4" aria-live="polite">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-primary" aria-hidden />Suggested</h3>
              {suggestions.length ? (
                <ul className="space-y-1 text-sm text-muted-foreground">{suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
              ) : <p className="text-sm text-muted-foreground">No schedule conflicts or preparation gaps found in your loaded events.</p>}
            </div>
          </CardContent>
        </Card>
        {bookingsLoading && <p role="status" className="text-sm text-muted-foreground">Loading your bookings…</p>}
        {bookingsError && <p role="alert" className="text-sm text-destructive">{bookingsError}</p>}
      </section>

      <Dialog open={calendarOpen} onOpenChange={onCalendarOpenChange}>
        <DialogContent
          className="max-h-[90dvh] max-w-3xl overflow-y-auto p-4 sm:p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <DialogTitle>Event calendar</DialogTitle>
          <DialogDescription>Review the event schedule, your bookings, and the available booking action.</DialogDescription>
          <Tabs value={calendarTab} onValueChange={setCalendarTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="bookings">My bookings</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="space-y-4">
              {renderMonthCalendar(allEvents, true)}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{selectedCalendarEvent.title}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(selectedCalendarEvent.start_time), "EEEE, MMMM d · p")} · local time</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={selectedCalendarEvent.id !== activeEvent.id || bookingDisabled || participation === "going"} onClick={onBook}>
                    {selectedCalendarEvent.id !== activeEvent.id || participation === "going" ? "Already booked" : "Continue to booking"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadEvent(selectedCalendarEvent)}>Add to calendar</Button>
                </div>
                {selectedCalendarEvent.id === activeEvent.id && bookingReason && <p className="basis-full text-sm text-muted-foreground" role="status">{bookingReason}</p>}
              </div>
            </TabsContent>
            <TabsContent value="bookings" className="space-y-3">
              {bookingsLoading ? <div className="flex justify-center p-8"><KretopiaSpinner /></div> : bookingsError ? (
                <p role="alert" className="text-sm text-destructive">{bookingsError}</p>
              ) : bookedEvents.length ? (
                bookedEvents.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => selectEventInModal(item)}>
                      <span className="block truncate font-semibold">{item.title}</span>
                      <span className="text-sm text-muted-foreground">{format(new Date(item.start_time), "EEE, MMM d · p")}</span>
                    </button>
                    <Button type="button" variant="outline" onClick={() => downloadEvent(item)}>Add to calendar</Button>
                  </div>
                ))
              ) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{userId ? "No confirmed bookings found." : "Sign in to see your booked events."}</p>}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EventCalendarWorkspace;
