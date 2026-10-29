import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The offers found outside Kretopia that the Match deck mixes in: which listings it reads, who has already answered them, what an
 * answer writes, and the things it must never touch (notifications, matches, connections, anything that would reach a person).
 */
const db = vi.hoisted(() => ({
  listings: [] as Record<string, unknown>[],
  listingsError: null as { message: string } | null,
  answered: [] as { target_id: string }[],
  insertError: null as { code?: string; message: string } | null,
  tables: [] as string[],
  eq: [] as [string, unknown][],
  inserted: [] as Record<string, unknown>[],
  deleted: [] as [string, unknown][],
  functionsCalled: 0,
  listingsThrow: false,
  limits: [] as [string, number][],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: () => { db.functionsCalled += 1; return Promise.resolve({}); } },
    from: (table: string) => {
      db.tables.push(table);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, v: unknown) => (db.eq.push([`${table}.${c}`, v]), q);
      q.order = () => q;
      q.limit = (n: number) => {
        db.limits.push([table, n]);
        if (table === "swipes") return Promise.resolve({ data: db.answered, error: null });
        return db.listingsThrow ? Promise.reject(new Error("offline")) : Promise.resolve({ data: db.listings, error: db.listingsError });
      };
      q.insert = (row: Record<string, unknown>) => (db.inserted.push(row), Promise.resolve({ error: db.insertError }));
      q.delete = () => ({
        eq: (c1: string, v1: unknown) => ({
          eq: (c2: string, v2: unknown) => ({
            eq: (c3: string, v3: unknown) => { db.deleted.push([c2, v2], [c3, v3], [c1, v1]); return Promise.resolve({ error: null }); },
          }),
        }),
      });
      return q;
    },
  },
}));

import { useExternalOffers } from "../useExternalOffers";

const listing = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: "gig", status: "published", title: `Offer ${id}`, original_publisher: "Acme", location: "Lisbon", remote_scope: "remote", source_published_at: null,
  deadline_at: null, apply_url: `https://acme.example/jobs/${id}`, excerpt: "Short.", last_checked_at: null, source_provider: "remoteok", claimed: false, ...over,
});

beforeEach(() => {
  db.listings = [listing("a"), listing("b"), listing("c")];
  db.listingsError = null;
  db.answered = [];
  db.insertError = null;
  db.listingsThrow = false;
  db.tables.length = 0;
  db.eq.length = 0;
  db.inserted.length = 0;
  db.deleted.length = 0;
  db.limits.length = 0;
  db.functionsCalled = 0;
  sessionStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("useExternalOffers: reading", () => {
  it("reads nothing while disabled or without a member, and says no offers", async () => {
    const off = renderHook(() => useExternalOffers("u1", false));
    const anon = renderHook(() => useExternalOffers(undefined, true));
    await new Promise((r) => setTimeout(r, 10));
    expect(off.result.current.offers).toEqual([]);
    expect(anon.result.current.offers).toEqual([]);
    expect(db.tables).toEqual([]);
  });

  it("reads gigs from the public view only, and drops the ones this member already answered", async () => {
    db.answered = [{ target_id: "b" }];
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers.map((o) => o.id)).toEqual(["a", "c"]));
    expect(db.eq).toContainEqual(["public_external_listings.kind", "gig"]);
    expect(db.eq).toContainEqual(["swipes.target_type", "opportunity"]);
    expect(db.eq).toContainEqual(["swipes.user_id", "u1"]);
    expect(new Set(db.tables)).toEqual(new Set(["public_external_listings", "swipes"]));
  });

  it("the deck is filled from the unanswered gigs, so a member who answered the newest 30 sees the next ones", async () => {
    const all = Array.from({ length: 45 }, (_, i) => listing(`g${String(i).padStart(2, "0")}`));
    db.listings = all;
    db.answered = all.slice(0, 30).map((l) => ({ target_id: l.id as string }));
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(15));
    expect(result.current.offers.map((o) => o.id)).toEqual(all.slice(30).map((l) => l.id));
  });

  it("a fresh member gets at most 30 offers, the newest first, from a window wider than the deck", async () => {
    db.listings = Array.from({ length: 60 }, (_, i) => listing(`g${String(i).padStart(2, "0")}`));
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(30));
    expect(result.current.offers[0].id).toBe("g00");
    expect(result.current.offers[29].id).toBe("g29");
    expect(db.limits).toContainEqual(["public_external_listings", 200]);
  });

  it("what this member answered is read with short filters, never a list of every listing id in the address", async () => {
    db.listings = Array.from({ length: 150 }, (_, i) => listing(`g${i}`));
    renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(db.tables).toContain("swipes"));
    expect(db.eq).toContainEqual(["swipes.user_id", "u1"]);
    expect(db.eq).toContainEqual(["swipes.target_type", "opportunity"]);
    expect(db.limits).toContainEqual(["swipes", 1000]);
  });

  it("a failed or empty read means no offers and never throws into the deck", async () => {
    db.listingsError = { message: "boom" };
    const failed = renderHook(() => useExternalOffers("u1", true));
    await new Promise((r) => setTimeout(r, 10));
    expect(failed.result.current.offers).toEqual([]);

    db.listingsError = null;
    db.listingsThrow = true;
    const thrown = renderHook(() => useExternalOffers("u1", true));
    await new Promise((r) => setTimeout(r, 10));
    expect(thrown.result.current.offers).toEqual([]);
  });

  it("skips a row with no id or no title", async () => {
    db.listings = [listing("a"), { ...listing("b"), title: "" }, { ...listing("c"), id: "" }];
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers.map((o) => o.id)).toEqual(["a"]));
  });
});

describe("useExternalOffers: answering", () => {
  it("'interested' writes one swipe row (the listing as an 'opportunity') and the card is gone at once", async () => {
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(3));
    let saved = false;
    await act(async () => { saved = await result.current.resolve(result.current.offers[0], "right"); });
    expect(saved).toBe(true);
    expect(db.inserted).toEqual([{ user_id: "u1", target_id: "a", target_type: "opportunity", direction: "right" }]);
    expect(result.current.offers.map((o) => o.id)).toEqual(["b", "c"]);
  });

  it("'pass' writes a left swipe", async () => {
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(3));
    await act(async () => { await result.current.resolve(result.current.offers[1], "left"); });
    expect(db.inserted).toEqual([{ user_id: "u1", target_id: "b", target_type: "opportunity", direction: "left" }]);
  });

  it("a write that fails still removes the card, remembers it for this session, and does not come back on a reload", async () => {
    db.insertError = { message: "violates check constraint" };
    const first = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(first.result.current.offers).toHaveLength(3));
    let saved = true;
    await act(async () => { saved = await first.result.current.resolve(first.result.current.offers[0], "right"); });
    expect(saved).toBe(false);
    expect(first.result.current.offers.map((o) => o.id)).toEqual(["b", "c"]);
    first.unmount();

    db.insertError = null;
    const again = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(again.result.current.offers.map((o) => o.id)).toEqual(["b", "c"]));
  });

  it("an answer already saved elsewhere (a second tab) is not an error", async () => {
    db.insertError = { code: "23505", message: "duplicate key" };
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(3));
    await act(async () => { await result.current.resolve(result.current.offers[0], "right"); });
    expect(result.current.offers.map((o) => o.id)).toEqual(["b", "c"]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("undo takes the answer back: the row is deleted and the card returns to the front", async () => {
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(3));
    const first = result.current.offers[0];
    await act(async () => { await result.current.resolve(first, "right"); });
    await act(async () => { await result.current.restore(first); });
    expect(result.current.offers.map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(db.deleted).toContainEqual(["target_id", "a"]);
    expect(db.deleted).toContainEqual(["target_type", "opportunity"]);
    await act(async () => { await result.current.restore(first); }); // twice does not duplicate it
    expect(result.current.offers.map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
});

describe("useExternalOffers: what it must never do", () => {
  it("touches only the public view and the member's own swipes: no notification, no function call, no match, no connection", async () => {
    const { result } = renderHook(() => useExternalOffers("u1", true));
    await waitFor(() => expect(result.current.offers).toHaveLength(3));
    await act(async () => { await result.current.resolve(result.current.offers[0], "right"); await result.current.resolve(result.current.offers[0], "left"); });
    await act(async () => { await result.current.restore(listing("a") as never); });
    expect(new Set(db.tables)).toEqual(new Set(["public_external_listings", "swipes"]));
    expect(db.functionsCalled).toBe(0);
    expect(db.inserted.every((r) => r.target_type === "opportunity" && r.user_id === "u1")).toBe(true);
  });
});
