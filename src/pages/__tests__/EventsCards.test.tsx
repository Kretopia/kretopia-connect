import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/brand/KretoScene", () => ({
  KretoScene: () => <div data-testid="brand-event-cover" />,
}));

import { EventCalendar, EventCard, type EventItem } from "../Events";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";

const event: EventItem = {
  id: "event-1",
  title: "Ceramic studio",
  description: "An open studio with local artists.",
  category: "workshop",
  venue_name: "Studio 8",
  start_time: new Date(2026, 4, 18, 18).toISOString(),
  max_participants: 12,
  participant_count: 4,
  creator_name: "Maya",
  created_by: "host-1",
};

function CalendarHarness({ onSelectEvent }: { onSelectEvent: (event: EventItem) => void }) {
  const [month, setMonth] = useState(new Date(2026, 4, 1, 12));
  const [selectedDay, setSelectedDay] = useState(new Date(2026, 4, 1, 12));
  return (
    <EventCalendar
      events={[event]}
      month={month}
      selectedDay={selectedDay}
      onMonthChange={setMonth}
      onSelectDay={setSelectedDay}
      onSelectEvent={onSelectEvent}
    />
  );
}

describe("event cards and calendar", () => {
  it("uses the shared flat card, honest availability, local timezone, and a real event action", () => {
    const onClick = vi.fn();
    render(<EventCard event={event} onClick={onClick} />);

    expect(screen.getByRole("button", { name: /view event & rsvp/i })).toBeEnabled();
    expect(screen.getByText("By Maya")).toBeInTheDocument();
    expect(screen.getByText(/Your time/)).toBeInTheDocument();
    expect(screen.getByText(/Places available/)).toBeInTheDocument();
    expect(screen.getByTestId("brand-event-cover")).toBeInTheDocument();
    expect(document.querySelector(".ai-scan-line")).toBeNull();
    expect(document.querySelector(".ai-ambient-breathe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /view event & rsvp/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not invent a currency for paid events", () => {
    render(
      <EventCard
        event={{ ...event, is_ticketed: true, ticket_price: 25, ticket_currency: undefined }}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/currency unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/\$25/)).not.toBeInTheDocument();
  });

  it("selects a calendar day and opens the same event card", () => {
    const onSelectEvent = vi.fn();
    render(<CalendarHarness onSelectEvent={onSelectEvent} />);

    fireEvent.click(screen.getByRole("button", { name: /Monday, May 18, 1 event/i }));
    expect(screen.getByRole("button", { name: /Monday, May 18, 1 event/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /view event & rsvp/i }));
    expect(onSelectEvent).toHaveBeenCalledWith(event);
  });

  it("moves keyboard focus and the displayed month together across a month boundary", () => {
    const onMonthChange = vi.fn();
    const onSelectDay = vi.fn();
    render(
      <EventCalendar
        events={[]}
        month={new Date(2026, 4, 1, 12)}
        selectedDay={new Date(2026, 4, 31, 12)}
        onMonthChange={onMonthChange}
        onSelectDay={onSelectDay}
        onSelectEvent={() => {}}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /Sunday, May 31, no events/i }), { key: "ArrowRight" });
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 5, 1));
    expect(onSelectDay).toHaveBeenCalledWith(new Date(2026, 5, 1, 12));
  });
});

describe("event time formatting", () => {
  it("discloses the viewer's timezone and handles invalid event dates", () => {
    expect(eventTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(formatEventTime("not-a-date")).toBe("Time unavailable");
    expect(formatEventTime(event.start_time)).toContain("May");
  });
});
