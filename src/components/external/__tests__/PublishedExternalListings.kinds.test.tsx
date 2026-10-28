import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * The Sourced lane for each kind (gigs, events, creatives): the words that fit, the one kind per list, and the 'Kept' mark on the gigs a
 * member marked interested in the Match deck.
 */
const state = vi.hoisted(() => ({
  user: null as null | { id: string },
  rows: [] as Record<string, unknown>[],
  kept: [] as { target_id: string }[],
  keptThrows: false,
  eq: [] as [string, unknown][],
  tables: [] as string[],
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.tables.push(table);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, v: unknown) => (state.eq.push([`${table}.${c}`, v]), q);
      q.order = () => q;
      q.limit = () => Promise.resolve({ data: state.rows, error: null });
      q.in = () => (state.keptThrows ? Promise.reject(new Error("offline")) : Promise.resolve({ data: state.kept, error: null }));
      return q;
    },
  },
}));

import { PublishedExternalListings } from "../PublishedExternalListings";

const row = (over: Record<string, unknown> = {}) => ({
  id: "l1", kind: "gig", status: "published", title: "Brand film editor", original_publisher: "Acme Studio", location: "Lisbon", remote_scope: "remote",
  source_published_at: null, deadline_at: null, apply_url: "https://acme-studio.com/x", excerpt: "A short summary.", last_checked_at: null, source_provider: "remoteok", claimed: false, ...over,
});
const renderList = (kind: "gig" | "event" | "talent") => render(<MemoryRouter><PublishedExternalListings kind={kind} /></MemoryRouter>);

beforeEach(() => {
  state.user = null;
  state.rows = [];
  state.kept = [];
  state.keptThrows = false;
  state.eq.length = 0;
  state.tables.length = 0;
});

describe("PublishedExternalListings: the words of each kind", () => {
  it.each([
    ["gig", "Apply at source", /nothing sourced here yet/i],
    ["event", "Open at source", /no sourced events yet/i],
    ["talent", "View at source", /no sourced creatives yet/i],
  ] as const)("a %s says '%s' and has its own empty state", async (kind, cta, empty) => {
    state.rows = [row({ kind })];
    const { unmount } = renderList(kind);
    expect(await screen.findByRole("link", { name: new RegExp(cta, "i") })).toHaveAttribute("href", "https://acme-studio.com/x");
    expect(screen.queryByRole("link", { name: /apply at source/i }) !== null).toBe(kind === "gig");
    unmount();
    state.rows = [];
    renderList(kind);
    expect(await screen.findByText(empty)).toBeInTheDocument();
  });

  it("asks for one kind only", async () => {
    state.rows = [row({ kind: "event" })];
    renderList("event");
    await screen.findByText("Brand film editor");
    expect(state.eq).toContainEqual(["public_external_listings.kind", "event"]);
    expect(state.eq.filter(([c]) => c.endsWith(".kind"))).toHaveLength(1);
  });
});

describe("PublishedExternalListings: Kept", () => {
  it("a signed-in member sees 'Kept' on the gigs they marked interested in, and only those", async () => {
    state.user = { id: "u1" };
    state.rows = [row(), row({ id: "l2", title: "Colourist" })];
    state.kept = [{ target_id: "l2" }];
    renderList("gig");
    await screen.findByText("Colourist");
    await waitFor(() => expect(screen.getAllByText("Kept")).toHaveLength(1));
    const keptCard = screen.getByText("Kept").closest("li")!;
    expect(keptCard).toHaveTextContent("Colourist");
    expect(state.eq).toContainEqual(["swipes.target_type", "opportunity"]);
    expect(state.eq).toContainEqual(["swipes.direction", "right"]);
    expect(state.eq).toContainEqual(["swipes.user_id", "u1"]);
  });

  it("a visitor is shown no mark and nothing about their answers is read", async () => {
    state.rows = [row()];
    renderList("gig");
    await screen.findByText("Brand film editor");
    expect(screen.queryByText("Kept")).not.toBeInTheDocument();
    expect(state.tables).toEqual(["public_external_listings"]);
  });

  it("events and creatives never read the member's answers", async () => {
    state.user = { id: "u1" };
    for (const kind of ["event", "talent"] as const) {
      state.rows = [row({ kind })];
      state.tables.length = 0;
      const { unmount } = renderList(kind);
      await screen.findByText("Brand film editor");
      expect(state.tables).toEqual(["public_external_listings"]);
      unmount();
    }
  });

  it("if the answers cannot be read the list still shows, just without the mark", async () => {
    state.user = { id: "u1" };
    state.rows = [row()];
    state.keptThrows = true;
    renderList("gig");
    expect(await screen.findByText("Brand film editor")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText("Kept")).not.toBeInTheDocument();
  });
});
