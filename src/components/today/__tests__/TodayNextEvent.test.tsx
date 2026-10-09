import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The next-event card on Today: the person's own event, its real cover when it
 * has one, Kreto's event art only when it has none, nothing at all otherwise.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

type Rows = Record<string, unknown>[];
let hosted: Rows = [];
let goingIds: Rows = [];
let attending: Rows = [];
const queried: string[] = [];

const chain = (table: string) => {
  const q: Record<string, unknown> = {};
  let usedIn = false;
  for (const m of ["select", "eq", "gte", "order", "limit"]) q[m] = () => q;
  q.in = () => { usedIn = true; return q; };
  q.then = (res: (v: unknown) => unknown) => {
    queried.push(`${table}${usedIn ? ":in" : ""}`);
    const data = table === "jam_participants" ? goingIds : usedIn ? attending : hosted;
    return Promise.resolve({ data, error: null }).then(res);
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => chain(t) } }));

import { TodayNextEvent } from "../TodayNextEvent";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event = (id: string, days: number, over: Record<string, unknown> = {}) => ({
  id, title: `Rooftop screening ${id}`, start_time: future(days), end_time: null, venue_name: "Le Palais, Paris",
  category: "film", cover_image_url: null, event_mode: "in_person", status: null, ...over,
});

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TodayNextEvent />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  hosted = [];
  goingIds = [];
  attending = [];
  queried.length = 0;
});

describe("TodayNextEvent", () => {
  it("renders nothing when the person has no upcoming event", async () => {
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the real cover, date, place and one action for an event the person hosts", async () => {
    hosted = [event("a", 3, { cover_image_url: "https://cdn.example.com/cover.jpg" })];
    const { container } = renderCard();
    const card = within(await screen.findByRole("region", { name: "Your next event" }));

    expect(card.getByRole("heading", { name: "Rooftop screening a" })).toBeInTheDocument();
    expect(card.getByText("Hosting")).toBeInTheDocument();
    expect(card.getByText("Le Palais, Paris")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Open event" })).toHaveAttribute("href", "/event/a");

    const cover = container.querySelector('img[src="https://cdn.example.com/cover.jpg"]')!;
    expect(cover).toHaveAttribute("loading", "lazy");
    expect(cover).toHaveAttribute("decoding", "async");
    // the real cover is there, so Kreto's art is not the picture of this event
    expect(container.querySelector('img[src*="kreto-director-mic"]')).toBeInTheDocument(); // still the loading placeholder until the cover loads
  });

  it("uses Kreto's event art only when the event has no cover of its own", async () => {
    hosted = [event("b", 2)];
    const { container } = renderCard();
    await screen.findByRole("region", { name: "Your next event" });
    expect(container.querySelector('img[src*="kreto-director-mic"]')).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("an event the person is going to is shown as going, found through their own RSVP", async () => {
    goingIds = [{ jam_id: "g1" }];
    attending = [event("g1", 1, { venue_name: null, event_mode: "online" })];
    renderCard();
    const card = within(await screen.findByRole("region", { name: "Your next event" }));
    expect(card.getByText("Going")).toBeInTheDocument();
    expect(card.getByText("Online")).toBeInTheDocument();
    expect(queried).toEqual(expect.arrayContaining(["creative_jams", "jam_participants", "creative_jams:in"]));
  });

  it("does not look up events by id when the person has not RSVP'd to any", async () => {
    hosted = [event("c", 4)];
    renderCard();
    await screen.findByRole("region", { name: "Your next event" });
    expect(queried).not.toContain("creative_jams:in");
  });

  it("skips a cancelled event", async () => {
    hosted = [event("d", 1, { status: "cancelled" })];
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });
});
