import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventPageShell } from "../EventPageShell";

describe("EventPageShell", () => {
  it("keeps the booking action singular and sections in the required DOM order", () => {
    const { container } = render(
      <EventPageShell
        eventTitle="Studio Night"
        hero={<section id="hero" />}
        about={<section id="about" />}
        attendees={<section id="attendees" />}
        calendar={<section id="schedule" />}
        host={<section id="host" />}
        bookingRail={<button type="button">I'm Going</button>}
      />,
    );

    const shell = screen.getByRole("region", { name: "Studio Night" });
    const ids = ["hero", "about", "attendees", "schedule", "host"];
    const elements = ids.map((id) => container.querySelector(`#${id}`));
    expect(elements.every(Boolean)).toBe(true);
    for (let index = 0; index < elements.length - 1; index += 1) {
      expect(elements[index]!.compareDocumentPosition(elements[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(shell).getAllByRole("button", { name: "I'm Going" })).toHaveLength(1);
  });
});
