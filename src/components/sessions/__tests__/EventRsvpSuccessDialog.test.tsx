import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventRsvpSuccessDialog } from "../EventRsvpSuccessDialog";
import { useState } from "react";

const event = {
  id: "event-1",
  title: "Studio Night",
  start_time: "2027-05-04T18:00:00.000Z",
};

describe("EventRsvpSuccessDialog", () => {
  it("opens once for each confirmed booking sequence, not on ordinary rerenders", async () => {
    const { rerender } = render(<EventRsvpSuccessDialog event={event} successSequence={0} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<EventRsvpSuccessDialog event={event} successSequence={1} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(<EventRsvpSuccessDialog event={event} successSequence={1} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the booking trigger", async () => {
    function Harness() {
      const [sequence, setSequence] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setSequence((value) => value + 1)}>Book event</button>
          <EventRsvpSuccessDialog event={event} successSequence={sequence} />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Book event" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
