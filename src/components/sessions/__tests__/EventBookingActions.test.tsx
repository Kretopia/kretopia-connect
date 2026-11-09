import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventBookingActions } from "../EventBookingActions";

const draw = (over: Partial<React.ComponentProps<typeof EventBookingActions>> = {}) => {
  const onBook = vi.fn();
  render(<EventBookingActions label="I'm Going" priceLabel={null} goingLabel="12 going" reason={null} disabled={false} joining={false} onBook={onBook} {...over} />);
  return { onBook };
};

beforeEach(() => {
  vi.stubGlobal("open", vi.fn());
});

describe("EventBookingActions: RSVP and tickets are two different actions", () => {
  it("with an external ticket link, RSVP stays an RSVP button and tickets are a separate link to the seller", () => {
    const { onBook } = draw({ ticketUrl: "https://tickets.example.com/studio-night" });
    const rsvp = screen.getByRole("button", { name: "I'm Going" });
    const tickets = screen.getByRole("link", { name: /Get tickets/ });
    expect(tickets).toHaveAttribute("href", "https://tickets.example.com/studio-night");
    expect(tickets).toHaveAttribute("target", "_blank");
    expect(tickets).toHaveAttribute("rel", "noopener noreferrer");
    expect(tickets).not.toHaveAttribute("type");
    expect(rsvp).not.toBe(tickets);
    expect(screen.getByText("Tickets and payment are handled by the seller, not by Kretopia.")).toBeInTheDocument();

    fireEvent.click(rsvp);
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("without one there is no ticket action at all", () => {
    draw();
    expect(screen.queryByRole("link", { name: /tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/handled by the seller/)).not.toBeInTheDocument();
  });

  it("an event whose paid tickets cannot be sold here says so and offers no RSVP", () => {
    draw({ label: "Tickets unavailable", disabled: true, reason: "Online ticket sales aren't available for this event." });
    expect(screen.getByRole("button", { name: "Tickets unavailable" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Online ticket sales aren't available for this event.");
  });
});
