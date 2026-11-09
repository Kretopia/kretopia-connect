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

  it("puts the host's tools right under the header, before any of the page's content", () => {
    const { container } = render(
      <EventPageShell
        eventTitle="Studio Night"
        hero={<section id="hero" />}
        hostTools={<section id="host-tools" aria-label="Host tools" />}
        about={<section id="about" />}
        attendees={<section id="attendees" />}
        calendar={<section id="schedule" />}
        host={<section id="host" />}
        bookingRail={<button type="button">I'm Going</button>}
      />,
    );
    const order = ["hero", "host-tools", "about", "attendees", "schedule", "host"].map((id) => container.querySelector(`#${id}`));
    expect(order.every(Boolean)).toBe(true);
    for (let index = 0; index < order.length - 1; index += 1) {
      expect(order[index]!.compareDocumentPosition(order[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("draws nothing in that place when there are no host tools, as for a visitor", () => {
    const { container } = render(
      <EventPageShell
        eventTitle="Studio Night"
        hero={<section id="hero" />}
        about={<section id="about" />}
        attendees={null}
        calendar={null}
        host={null}
        bookingRail={<button type="button">I'm Going</button>}
      />,
    );
    expect(screen.queryByRole("region", { name: "Host tools" })).not.toBeInTheDocument();
    // hero, then the content wrapper: no empty wrapper sits between them.
    const hero = container.querySelector("#hero")!;
    expect(hero.nextElementSibling?.querySelector("#about")).not.toBeNull();
  });
});
