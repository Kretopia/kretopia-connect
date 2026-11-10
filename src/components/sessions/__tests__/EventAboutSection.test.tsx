import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { EventAboutSection } from "../EventAboutSection";

describe("EventAboutSection", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 120 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 48 });
  });

  it("clamps to two mobile lines and three desktop lines, then expands in place", () => {
    render(
      <EventAboutSection
        description="An event description long enough to overflow the preview."
        program={<p>No line-up or program details are listed for this event.</p>}
        venue={<p>Online event · Workshop.</p>}
        policies={<p>RSVP availability is confirmed by the event service.</p>}
        faq={<p>Use I'm Going to RSVP.</p>}
      />,
    );

    const paragraph = screen.getByText("An event description long enough to overflow the preview.");
    expect(paragraph.className).toContain("line-clamp-2");
    expect(paragraph.className).toContain("md:line-clamp-3");

    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(paragraph.className).not.toContain("line-clamp-2");
    expect(screen.getByRole("button", { name: "Read less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps every former event detail block in the About section in the required order", () => {
    const { container } = render(
      <EventAboutSection
        description="About this event"
        program={<p>No line-up or program details are listed for this event.</p>}
        venue={<p>Venue details</p>}
        policies={<p>Guests may RSVP without creating an account.</p>}
        faq={<p>Where do I find the address?</p>}
      />,
    );

    expect(container.querySelector("#about-program")).toHaveTextContent("No line-up or program details are listed for this event.");
    expect(container.querySelector("#about-venue")).toHaveTextContent("Venue details");
    expect(container.querySelector("#about-policies")).toHaveTextContent("Guests may RSVP without creating an account.");
    expect(container.querySelector("#about-faq")).toHaveTextContent("Where do I find the address?");
    const blocks = ["about-program", "about-venue", "about-policies", "about-faq"].map((id) => container.querySelector(`#${id}`));
    expect(blocks.map((block) => [...container.querySelectorAll("section")].indexOf(block as HTMLElement))).toEqual([1, 2, 3, 4]);
  });

  it("draws only the sections it is given: a section left out (hidden by the host) is not in the page at all", () => {
    const { container } = render(<EventAboutSection description="About this event" program={<p>19:00 Doors</p>} venue={null} policies={false} />);
    expect(container.querySelector("#about-program")).toHaveTextContent("19:00 Doors");
    for (const id of ["about-venue", "about-policies", "about-faq"]) expect(container.querySelector(`#${id}`)).toBeNull();
    expect(screen.queryByText("Venue")).not.toBeInTheDocument();
  });

  it("marks a hidden section for the host who is still shown it, and marks nothing else", () => {
    const { container } = render(
      <EventAboutSection description="About" program={<p>Line-up</p>} faq={<p>Questions</p>} hiddenFromVisitors={{ faq: true }} />,
    );
    expect(container.querySelector("#about-faq")).toHaveTextContent("Hidden from visitors");
    expect(container.querySelector("#about-program")).not.toHaveTextContent("Hidden from visitors");
    expect(screen.getAllByText("Hidden from visitors")).toHaveLength(1);
  });
});
