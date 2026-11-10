import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ downloadIcs: vi.fn() }));
vi.mock("@/lib/eventActions", () => ({ downloadIcs: (...args: unknown[]) => m.downloadIcs(...args) }));

import { EventCalendarActions, type CalendarActionEvent } from "../EventCalendarActions";

const event: CalendarActionEvent = {
  id: "e1", title: "Studio Night", description: "Bring stems.", startTime: "2026-12-05T18:30:00.000Z", endTime: "2026-12-05T21:00:00.000Z",
  venueName: "Studio Nine", venueAddress: "1 Rue Exemple", url: "https://kretopia.com/event/e1",
};

const draw = (over: Partial<React.ComponentProps<typeof EventCalendarActions>> = {}) => {
  const handlers = { onToggleSaved: vi.fn(), onSignIn: vi.fn() };
  render(<EventCalendarActions event={event} signedIn saveAvailable saved={false} busy={false} {...handlers} {...over} />);
  return handlers;
};
const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: /calendar/i }), { key: "Enter" });

beforeEach(() => {
  m.downloadIcs.mockReset();
  vi.stubGlobal("open", vi.fn());
});

describe("EventCalendarActions: the compact menu keeps my calendar and export apart", () => {
  it("names two groups: my Kretopia calendar, and export to another calendar", () => {
    draw();
    openMenu();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("My Kretopia calendar")).toBeInTheDocument();
    expect(within(menu).getByText("Export to another calendar")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Add to my calendar", ".ics file (Apple, Outlook)", "Google Calendar"]);
  });

  it("adding to my calendar asks the page to save it, and nothing about it says RSVP, booking or ticket", () => {
    const { onToggleSaved, onSignIn } = draw();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Add to my calendar" }));
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(m.downloadIcs).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/RSVP|book|ticket|going/i);
  });

  it("an event already on the calendar says so, and the same item takes it off", () => {
    const { onToggleSaved } = draw({ saved: true });
    expect(screen.getByRole("button", { name: /on my calendar/i })).toHaveTextContent("On my calendar");
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from my calendar" }));
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("exporting needs no account and saves nothing: a .ics download, or Google Calendar in a new tab", () => {
    const { onToggleSaved } = draw({ signedIn: false });
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: ".ics file (Apple, Outlook)" }));
    expect(m.downloadIcs).toHaveBeenCalledWith(event);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Google Calendar" }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("https://calendar.google.com/calendar/render?"), "_blank", "noopener,noreferrer");
    expect(onToggleSaved).not.toHaveBeenCalled();
  });

  it("a visitor is asked to sign in to add it to their calendar, not signed in silently", () => {
    const { onSignIn, onToggleSaved } = draw({ signedIn: false });
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign in to add to my calendar" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onToggleSaved).not.toHaveBeenCalled();
  });

  it("says plainly when saving is not available yet, offers no save, and still exports", () => {
    const { onToggleSaved } = draw({ saveAvailable: false });
    openMenu();
    const save = screen.getByRole("menuitem", { name: "Add to my calendar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saving to your Kretopia calendar isn't available yet");
    fireEvent.click(save);
    expect(onToggleSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Google Calendar" })).not.toHaveAttribute("aria-disabled");
  });

  it("cannot be pressed again while a save is in flight", () => {
    const { onToggleSaved } = draw({ busy: true });
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Add to my calendar" })).toHaveAttribute("aria-disabled", "true");
    expect(onToggleSaved).not.toHaveBeenCalled();
  });
});

describe("EventCalendarActions: the side-by-side buttons say the same things", () => {
  it("shows my calendar and the two exports as separate buttons, with the save as a pressed toggle", () => {
    const { onToggleSaved } = draw({ layout: "buttons" });
    const group = screen.getByRole("group", { name: "Calendar" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Add to my calendar", "Export .ics", "Google Calendar"]);
    const save = within(group).getByRole("button", { name: "Add to my calendar" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(save);
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("is a pressed toggle when saved, disabled with an explanation when saving is unavailable, and sends a visitor to sign in", () => {
    const first = render(<EventCalendarActions layout="buttons" event={event} signedIn saveAvailable saved busy={false} onToggleSaved={vi.fn()} onSignIn={vi.fn()} />);
    expect(screen.getByRole("button", { name: "On my calendar" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    const second = render(<EventCalendarActions layout="buttons" event={event} signedIn saveAvailable={false} saved={false} busy={false} onToggleSaved={vi.fn()} onSignIn={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add to my calendar" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("isn't available yet");
    second.unmount();
    const onSignIn = vi.fn();
    render(<EventCalendarActions layout="buttons" event={event} signedIn={false} saveAvailable={false} saved={false} busy={false} onToggleSaved={vi.fn()} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to my calendar" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

describe("EventCalendarActions: the menu trigger on a narrow row", () => {
  it("keeps its full name at every size and draws the words only from sm, so the When row beside it is not squeezed on a phone", () => {
    draw();
    const trigger = screen.getByRole("button", { name: "Add to calendar" });
    const label = within(trigger).getByText("Add to calendar");
    expect(label).toHaveClass("hidden", "sm:inline");
    // the icon and the menu chevron stay, so the button is never blank
    expect(trigger.querySelectorAll("svg")).toHaveLength(2);
  });

  it("says it is on the calendar the same way: a check, the fill, the full accessible name, and the words from sm", () => {
    draw({ saved: true });
    const trigger = screen.getByRole("button", { name: "Calendar: on my calendar" });
    expect(within(trigger).getByText("On my calendar")).toHaveClass("hidden", "sm:inline");
    expect(trigger.querySelectorAll("svg")).toHaveLength(2);
  });
});

describe("EventCalendarActions: as a full-width row", () => {
  it("draws its label at every width when asked, and hides it on a narrow row otherwise", () => {
    draw({ labelAlways: true });
    expect(screen.getByText("Add to calendar").className).not.toContain("hidden");
    cleanup();
    draw();
    expect(screen.getByText("Add to calendar").className).toContain("hidden");
    // The accessible name is the full label either way.
    expect(screen.getByRole("button", { name: "Add to calendar" })).toBeInTheDocument();
  });
});
