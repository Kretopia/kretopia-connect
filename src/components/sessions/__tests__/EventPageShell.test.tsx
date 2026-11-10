import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SharedFooterProvider } from "@/components/layout/sharedFooter";
import { EventPageShell } from "../EventPageShell";

const slots = (extra: Partial<Parameters<typeof EventPageShell>[0]> = {}) => (
  <EventPageShell
    eventTitle="Studio Night"
    hero={<section id="hero" />}
    booking={<section id="booking-block" aria-label="Event booking"><button type="button" data-booking-cta="primary">I'm Going</button></section>}
    about={<section id="about" />}
    crew={<section id="attendees" />}
    calendar={<section id="schedule" />}
    {...extra}
  />
);

const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("EventPageShell: one wrapper", () => {
  it("places the cover, then the booking block, then the page's content: the order a phone reads", () => {
    const { container } = render(slots({ gallery: <section id="gallery" />, afterCrew: <section id="after" /> }));
    const order = ["hero", "booking-block", "about", "gallery", "attendees", "schedule", "after"].map((id) => container.querySelector(`#${id}`)!);
    expect(order.every(Boolean)).toBe(true);
    for (let index = 0; index < order.length - 1; index += 1) expect(before(order[index], order[index + 1])).toBe(true);
  });

  it("keeps the booking action singular and #event-booking on the block that holds it", () => {
    const { container } = render(slots());
    const shell = screen.getByRole("region", { name: "Studio Night" });
    expect(shell.querySelectorAll('[data-booking-cta="primary"]')).toHaveLength(1);
    expect(container.querySelector("#event-booking")).toContainElement(container.querySelector("#booking-block") as HTMLElement);
    expect(container.querySelectorAll("#event-booking")).toHaveLength(1);
  });

  it("makes the booking column sticky from lg, in the right-hand rail, and not fixed to the screen", () => {
    const { container } = render(slots());
    const rail = container.querySelector("#event-booking")!;
    expect(rail.className).toContain("lg:sticky");
    expect(rail.className).toContain("lg:col-start-2");
    expect(rail.className).not.toMatch(/(^|\s)fixed(\s|$)/);
  });

  it("puts a notice about the event first, above the cover, and the host's tools right under the cover, before About", () => {
    const { container } = render(slots({ notices: <p id="notice">Cancelled</p>, hostTools: <section id="host-tools" aria-label="Host tools" /> }));
    const [notice, hero, tools, about] = ["notice", "hero", "host-tools", "about"].map((id) => container.querySelector(`#${id}`)!);
    expect(before(notice, hero) && before(hero, tools) && before(tools, about)).toBe(true);
    // The notice spans the page: it is not inside either column.
    expect(notice.closest("[data-event-slot]")).toBeNull();
  });

  it("is the only place that sets the page's width and gutters", () => {
    const { container } = render(slots());
    const wrappers = container.querySelectorAll('[class~="max-w-7xl"]');
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]).toContainElement(container.querySelector("#hero") as HTMLElement);
    expect(wrappers[0]).toContainElement(container.querySelector("#schedule") as HTMLElement);
  });

  it("leaves room under the content for the phone's booking bar only when no footer does", () => {
    const { container, rerender } = render(slots());
    expect(container.querySelector('[class~="max-w-7xl"]')!.className).toContain("pb-40");
    rerender(<SharedFooterProvider value>{slots()}</SharedFooterProvider>);
    expect(container.querySelector('[class~="max-w-7xl"]')!.className).toContain("pb-10");
  });
});
