import { render, screen, within } from "@testing-library/react";
import { CalendarDays, MapPin, Shield, Ticket, UserRound, Users } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EventOptionsList, type EventOptionRowData } from "../EventOptionsList";

const rows: EventOptionRowData[] = [
  { id: "when", label: "When", value: "Sat, May 4 · 6:00 PM", icon: CalendarDays, action: <button>Add to calendar</button> },
  { id: "where", label: "Where", value: "Studio 8", icon: MapPin, action: <button>Open map</button> },
  { id: "price", label: "Price", value: "Free", icon: Ticket, action: <a href="#event-booking">I'm Going</a> },
  { id: "host", label: "Host", value: "Maya Santos", icon: UserRound, action: <a href="#host">Contact host</a> },
  { id: "attendees", label: "Attendees", value: "6 going", icon: Users, action: <a href="#attendees">Who's coming</a> },
  { id: "policies", label: "Policies", value: "See event policies", icon: Shield, action: <a href="#about-policies">View policies</a> },
];

describe("EventOptionsList", () => {
  it("renders all topics and aligns each action in the shared grid track", () => {
    render(<EventOptionsList rows={rows} />);

    const list = screen.getByRole("region", { name: "Event options" });
    expect(within(list).getAllByText(/^(Add to calendar|Open map|I'm Going|Contact host|Who's coming|View policies)$/)).toHaveLength(6);
    const rowGrids = Array.from(list.querySelectorAll("[data-option-row]"));
    expect(rowGrids).toHaveLength(6);
    expect(new Set(rowGrids.map((row) => row.className)).size).toBe(1);
  });
});
