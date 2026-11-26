import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  searches: [] as string[],
  auth: { user: { id: "viewer" }, loading: false },
  toasts: { toast: () => {} },
}));

// A chainable query builder that records the text of each typed search sent to the server as .or(...).
vi.mock("@/integrations/supabase/client", () => {
  const make = () => {
    const chain: any = {};
    for (const m of ["eq", "neq", "not", "ilike", "gte", "in", "order", "limit", "is"]) chain[m] = () => chain;
    chain.or = (filter: string) => { db.searches.push(filter); return chain; };
    chain.select = () => chain;
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
    return chain;
  };
  return { supabase: { from: make, functions: { invoke: vi.fn() } } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => db.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => db.toasts }));

import { BrowseCreators } from "../BrowseCreators";

const renderGrid = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BrowseCreators />
    </MemoryRouter>,
  );

describe("Grid: a search term that arrives with the link", () => {
  it("is typed into the Grid's own search bar and searched on arrival", async () => {
    db.searches.length = 0;
    renderGrid("/match?tab=browse&view=grid&q=Motion");
    expect(screen.getByPlaceholderText("Search by name, role, bio…")).toHaveValue("Motion");
    await waitFor(() => expect(db.searches.some((f) => /Motion/.test(f))).toBe(true));
  });

  it("leaves the bar empty and searches nothing in particular without one", async () => {
    db.searches.length = 0;
    renderGrid("/match?tab=browse&view=grid");
    expect(screen.getByPlaceholderText("Search by name, role, bio…")).toHaveValue("");
    await waitFor(() => expect(screen.getByPlaceholderText("Search by name, role, bio…")).toBeInTheDocument());
    expect(db.searches.some((f) => /Motion/.test(f))).toBe(false);
  });

  it("trims the words and keeps spaces", () => {
    renderGrid("/match?tab=browse&view=grid&q=%20Motion%20Design%20");
    expect(screen.getByPlaceholderText("Search by name, role, bio…")).toHaveValue("Motion Design");
  });
});
