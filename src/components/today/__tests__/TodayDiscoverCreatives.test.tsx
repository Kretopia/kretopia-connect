import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Discover Creatives on Today: only real, permitted data; people are photos or
 * initials, never Kreto art; one action per Passport; nothing moves by itself.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));

type Rows = Record<string, unknown>[];
let profiles: Rows = [];
let credits: Rows = [];

const chain = (rows: () => Rows) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "not", "order", "limit", "in"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res);
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => chain(() => (table === "credits" ? credits : profiles)) },
}));

import { TodayDiscoverCreatives } from "../TodayDiscoverCreatives";

const person = (i: number, over: Record<string, unknown> = {}) => ({
  user_id: `u${i}`, username: `user${i}`, full_name: `Maya Laurent ${i}`, role: `Role ${i}`,
  avatar_url: null, cover_image_url: null, location: "Paris", verification_tier: null, ...over,
});

const renderRail = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TodayDiscoverCreatives />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  profiles = [];
  credits = [];
});

describe("TodayDiscoverCreatives", () => {
  it("renders nothing when there are no Passports to show", async () => {
    const { container } = renderRail();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it("says only what is true, and has one action per Passport", async () => {
    profiles = Array.from({ length: 7 }, (_, i) => person(i + 1, i === 0 ? { verification_tier: "elite", avatar_url: "https://cdn.example.com/a.jpg" } : {}));
    credits = [
      { user_id: "u1", verification_status: "verified", verified_by_name: "Nord Films" },
      { user_id: "u1", verification_status: null },
      { user_id: "u2", verification_status: null },
    ];
    renderRail();

    expect(await screen.findByRole("heading", { name: "Discover Creatives" })).toBeInTheDocument();
    expect(screen.getByText("Real Passports from the Kretopia community.")).toBeInTheDocument();
    expect(screen.queryByText(/worldwide/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hover or touch/i)).not.toBeInTheDocument();

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      expect(within(card).getAllByRole("link")).toHaveLength(1);
      expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    }
    const first = within(cards[0]);
    expect(first.getByRole("link", { name: /View Maya Laurent 1's Passport/ })).toHaveAttribute("href", "/@user1");
    expect(first.getByText("Elite Verified")).toBeInTheDocument();
    expect(first.getByText("2 credits · 1 confirmed")).toBeInTheDocument();
    expect(within(cards[1]).getByText("1 credit · self-reported")).toBeInTheDocument();
    // no credits visible: no invented number
    expect(within(cards[2]).queryByText(/credit/i)).not.toBeInTheDocument();
  });

  it("shows a person as their photo or their initials, never as a Kreto illustration", async () => {
    profiles = Array.from({ length: 7 }, (_, i) => person(i + 1, i === 0 ? { avatar_url: "https://cdn.example.com/a.jpg" } : {}));
    const { container } = renderRail();
    await screen.findAllByRole("article");

    expect(container.querySelector('img[src*="kreto"]')).toBeNull();
    const withPhoto = container.querySelector('img[src="https://cdn.example.com/a.jpg"]')!;
    expect(withPhoto).toHaveAttribute("loading", "lazy");
    expect(withPhoto).toHaveAttribute("decoding", "async");
    // initials, not a mascot, for everyone without a photo
    expect(screen.getAllByRole("img", { name: /Maya Laurent 2/ })[0]).toHaveTextContent("M2"); // first and last word of "Maya Laurent 2"
  });

  it("does not move on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    profiles = Array.from({ length: 7 }, (_, i) => person(i + 1));
    const { container } = renderRail();
    await screen.findAllByRole("article");
    const track = container.querySelector('[aria-roledescription="carousel"]')!;
    const before = track.innerHTML;
    vi.advanceTimersByTime(30_000);
    expect(track.innerHTML).toBe(before);
    vi.useRealTimers();
  });
});
