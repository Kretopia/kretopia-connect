import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ openDirections: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/brand/KretoScene", () => ({ KretoScene: () => null }));
vi.mock("@/lib/eventActions", () => ({ openDirections: (...args: unknown[]) => m.openDirections(...args) }));

import { EventHeroCard } from "../EventHeroCard";

const event = {
  id: "e1", title: "Studio Night", category: "music", start_time: "2026-12-05T18:30:00.000Z", end_time: "2026-12-05T21:00:00.000Z",
  venue_name: "Studio Nine", venue_address: "1 Rue Exemple, Paris", event_mode: "irl", cover_image_url: "https://img.example.com/cover.jpg",
  gallery_image_urls: [], attendee_list_visibility: "public",
};

const draw = (over: Partial<React.ComponentProps<typeof EventHeroCard>> = {}) =>
  render(
    <EventHeroCard
      event={event}
      creator={{ full_name: "Ada Host" }}
      isCreator={false}
      isAuthenticated
      isPast={false}
      isCancelled={false}
      isCompleted={false}
      countdown={null}
      cityLabel="Studio Nine"
      priceLabel={null}
      participantCount={3}
      isFull={false}
      participation={null}
      joining={false}
      attendees={[]}
      attendeesVisible
      onShare={vi.fn()}
      onShowGuestPass={vi.fn()}
      onCancelRsvp={vi.fn()}
      calendarActions={<button type="button">Add to calendar</button>}
      onGalleryChange={vi.fn()}
      onSignIn={vi.fn()}
      {...over}
    />,
  );

beforeEach(() => m.openDirections.mockReset());

describe("EventHeroCard: calendar, tickets and what the host keeps hidden", () => {
  it("draws the calendar actions it is given in the When row", () => {
    const { container } = draw();
    const when = container.querySelector('[data-option-row="when"]') as HTMLElement;
    expect(within(when).getByRole("button", { name: "Add to calendar" })).toBeInTheDocument();
    // …and only there: the calendar is not also a ticket or RSVP action.
    expect(container.querySelector('[data-option-row="price"]')).not.toHaveTextContent(/calendar/i);
  });

  it("shows the address and a map button to a signed-in visitor when the venue is shown", () => {
    draw();
    expect(screen.getByText(/1 Rue Exemple, Paris/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open map/ }));
    expect(m.openDirections).toHaveBeenCalledWith("1 Rue Exemple, Paris", "Studio Nine");
  });

  it("a visitor does not get the address or the map once the host hides the venue, but still gets the venue's name", () => {
    draw({ venueDetailsVisible: false });
    expect(screen.queryByText(/1 Rue Exemple/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open map/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Studio Nine/).length).toBeGreaterThan(0);
  });

  it("the host always sees the address and the map, even with the venue hidden from visitors", () => {
    draw({ venueDetailsVisible: false, isCreator: true });
    expect(screen.getByText(/1 Rue Exemple, Paris/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open map/ })).toBeInTheDocument();
  });

  it("links to the policies only while the Policies section is shown", () => {
    const first = draw();
    expect(screen.getByRole("link", { name: "View policies" })).toHaveAttribute("href", "#about-policies");
    first.unmount();
    draw({ policiesVisible: false });
    expect(screen.queryByRole("link", { name: "View policies" })).not.toBeInTheDocument();
  });

  it("the Price row sends tickets sold elsewhere to the seller in a new tab, and otherwise points at the RSVP", () => {
    const first = draw({ ticketUrl: "https://tickets.example.com/e1" });
    const tickets = screen.getByRole("link", { name: /Get tickets/ });
    expect(tickets).toHaveAttribute("href", "https://tickets.example.com/e1");
    expect(tickets).toHaveAttribute("target", "_blank");
    expect(tickets).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "I'm Going" })).not.toBeInTheDocument();
    first.unmount();
    draw();
    expect(screen.getByRole("link", { name: "I'm Going" })).toHaveAttribute("href", "#event-booking");
    expect(screen.queryByRole("link", { name: /Get tickets/ })).not.toBeInTheDocument();
  });
});
