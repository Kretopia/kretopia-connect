import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.now();
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

const db = vi.hoisted(() => ({
  me: {
    role: "Photographer",
    sub_roles: null,
    location: "Port of Spain, Trinidad",
    professional_skills: ["lighting", "retouching"],
    passion_skills: null,
    avatar_url: "https://example.com/me.jpg",
    bio: "A bio that is comfortably more than twenty characters long.",
  },
  rows: [] as Record<string, unknown>[],
  // stable objects: the grid's effects depend on `user` and `toast`, so a new one per render would re-render forever
  auth: { user: { id: "viewer" }, loading: false },
  toasts: { toast: () => {} },
}));

// One chainable stand-in for the query builder. It remembers the table and the selected columns so the
// one query that lists candidates, the viewer's own profile read and the gate's reads each get their data.
vi.mock("@/integrations/supabase/client", () => {
  const make = (table: string) => {
    let cols = "";
    const chain: any = {};
    for (const m of ["eq", "neq", "not", "or", "ilike", "gte", "in", "order", "limit", "is"]) chain[m] = () => chain;
    chain.select = (c?: string) => { cols = c ?? ""; return chain; };
    const one = () => Promise.resolve({ data: table === "profiles" ? db.me : null, error: null });
    chain.single = one;
    chain.maybeSingle = one;
    chain.then = (resolve: (v: unknown) => unknown) => {
      if (table === "profiles" && cols.includes("last_active_date")) return resolve({ data: db.rows, error: null });
      return resolve({ data: [], error: null, count: 0 });
    };
    return chain;
  };
  return { supabase: { from: make, functions: { invoke: vi.fn() } } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => db.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => db.toasts }));

import { BrowseCreators } from "../BrowseCreators";

const row = (over: Record<string, unknown>) => ({
  user_id: "x",
  full_name: "Someone",
  avatar_url: "https://example.com/a.jpg",
  cover_image_url: null,
  role: "Chef",
  sub_roles: null,
  location: "Lagos, Nigeria",
  verification_tier: null,
  average_rating: null,
  professional_skills: [],
  bio: "bio",
  is_claimed: true,
  badge: null,
  last_active_date: null,
  collab_intent: null,
  ...over,
});

const renderGrid = () =>
  render(
    <MemoryRouter>
      <BrowseCreators />
    </MemoryRouter>,
  );

describe("Match grid: concrete reasons, no percentage", () => {
  it("shows why each person is suggested, never '% match', and keeps the strongest first", async () => {
    db.rows = [
      row({ user_id: "none", full_name: "Zed Nothing-in-common" }),
      row({
        user_id: "best",
        full_name: "Ava Chen",
        role: "Photographer",
        location: "Port of Spain, TT",
        professional_skills: ["Lighting", "Sound"],
        last_active_date: iso(3),
        collab_intent: "seeking_collaborators",
      }),
    ];
    renderGrid();

    const best = await screen.findByRole("button", { name: /Ava Chen/ });
    const reasons = within(best).getByRole("list", { name: "Why Ava Chen is suggested" });
    // two reasons per card, strongest first: same craft, then the skills they share
    expect(within(reasons).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Shared craft · Photographer",
      "Shared skills: Lighting",
    ]);

    // nothing in common: no list at all, not an invented reason
    const none = screen.getByRole("button", { name: /Zed Nothing-in-common/ });
    expect(within(none).queryByRole("list")).toBeNull();

    // the order is unchanged by hiding the number: the person with signals comes first
    const names = screen.getAllByRole("button").map((b) => b.textContent ?? "").filter((t) => /Ava Chen|Zed/.test(t));
    expect(names[0]).toMatch(/Ava Chen/);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*%\s*match/i);
    expect(text).not.toMatch(/\b1[0-9]{2}\s*%/); // no 100+ percentage anywhere
  });

  it("asks the profile table for the collaboration intent it uses for the 'open to collaborating' reason", async () => {
    db.rows = [row({ user_id: "open", full_name: "Open Person", role: "Photographer", collab_intent: "seeking_collaborators", professional_skills: [] })];
    renderGrid();
    const card = await screen.findByRole("button", { name: /Open Person/ });
    await waitFor(() => expect(within(card).getByRole("list")).toBeInTheDocument());
    expect(within(card).getByText("Shared craft · Photographer")).toBeInTheDocument();
    expect(within(card).getByText("Open to collaborating")).toBeInTheDocument();
  });
});
