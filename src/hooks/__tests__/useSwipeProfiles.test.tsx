import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  rawProfiles: [] as Row[],
  safeProfiles: [] as Row[],
  mySwipes: [] as Row[],
  likedMe: [] as Row[],
  me: { role: "Photographer", location: "Lagos", professional_skills: ["lighting"] } as Row,
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const eqs: Record<string, unknown> = {};
    let range: [number, number] | undefined;
    const page = (rows: Row[]) => range ? rows.slice(range[0], range[1] + 1) : rows;
    const resolve = () => {
      if (table === "swipes") return { data: "target_id" in eqs ? db.likedMe : db.mySwipes, error: null };
      if (table === "profiles") return { data: page(db.rawProfiles), error: null };
      if (table === "public_profiles_safe") return { data: page(db.safeProfiles), error: null };
      return { data: [], error: null };
    };
    const api: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (ok: any, bad: any) => Promise.resolve(resolve()).then(ok, bad);
          if (prop === "maybeSingle") return () => Promise.resolve({ data: table === "profiles" ? db.me : null, error: null });
          return (...args: unknown[]) => {
            if (prop === "eq") eqs[String(args[0])] = args[1];
            if (prop === "range") range = [Number(args[0]), Number(args[1])];
            return api;
          };
        },
      },
    );
    return api;
  };
  return { supabase: { from: chain } };
});

import { SAFE_VIEW_SELECT, fromSafeRow, useSwipeProfiles } from "../useSwipeProfiles";

const member = (user_id: string, extra: Row = {}): Row => ({
  user_id,
  full_name: `Member ${user_id}`,
  role: "Photographer",
  onboarding_completed: true,
  xp: 150,
  level: 2,
  updated_at: "2026-10-10T00:00:00Z",
  ...extra,
});

describe("useSwipeProfiles", () => {
  beforeEach(() => {
    db.rawProfiles = [];
    db.safeProfiles = [];
    db.mySwipes = [];
    db.likedMe = [];
    sessionStorage.clear();
  });

  it("selects only columns the safe view actually has", () => {
    expect(SAFE_VIEW_SELECT).not.toMatch(/sub_roles|passion_skills|collab_intent|is_claimed|latitude/);
  });

  it("shows real members from the safe view when `profiles` returns nothing (owner-only RLS)", async () => {
    db.rawProfiles = [];
    db.safeProfiles = [member("a"), member("b"), member("c")];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles.map((p) => p.user_id).sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps imported (unclaimed) profiles out: onboarding done but no XP and no ID check", async () => {
    db.safeProfiles = [member("real"), member("import", { xp: 0, id_verified: false }), member("verified", { xp: 0, id_verified: true })];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles.map((p) => p.user_id).sort()).toEqual(["real", "verified"]);
  });

  it("never offers yourself, someone already swiped on, or a half-empty profile", async () => {
    db.mySwipes = [{ target_id: "seen" }];
    db.safeProfiles = [member("seen"), member("nameless", { full_name: "" }), member("roleless", { role: "" }), member("ok")];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles.map((p) => p.user_id)).toEqual(["ok"]);
  });

  it("puts anyone who already swiped right on you first", async () => {
    db.likedMe = [{ user_id: "fan" }];
    db.safeProfiles = [member("top", { role: "Photographer", location: "Lagos" }), member("fan", { role: "Dancer", location: "Elsewhere" })];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles[0].user_id).toBe("fan");
  });

  it("is deterministic across loads", async () => {
    db.safeProfiles = ["p1", "p2", "p3", "p4", "p5"].map((id) => member(id, { role: id === "p3" ? "Singer" : "Photographer" }));
    const first = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const order1 = first.result.current.profiles.map((p) => p.user_id);
    sessionStorage.clear();
    const second = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.profiles.map((p) => p.user_id)).toEqual(order1);
  });

  it("uses the richer `profiles` row when RLS does let it through", async () => {
    db.rawProfiles = [{ ...member("a"), sub_roles: ["Editor"], is_claimed: true, collab_intent: "paid" }];
    db.safeProfiles = [member("a")];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].sub_roles).toEqual(["Editor"]);
  });

  it("still hides unclaimed non-ODOS rows when full `profiles` data says so", async () => {
    db.rawProfiles = [{ ...member("ghost"), is_claimed: false, badge: null }, { ...member("odos"), is_claimed: false, badge: "odos" }];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles.map((p) => p.user_id)).toEqual(["odos"]);
  });
  it("finds an unseen member after 1000 already-swiped candidates", async () => {
    db.safeProfiles = Array.from({ length: 1001 }, (_, i) => member(`p${i}`));
    db.mySwipes = db.safeProfiles.slice(0, 1000).map(p => ({ target_id: p.user_id }));
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles.map(p => p.user_id)).toEqual(["p1000"]);
  });

  it("quietly adds new members without resurrecting a locally consumed card", async () => {
    db.safeProfiles = [member("a")];
    const { result } = renderHook(() => useSwipeProfiles("me"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.removeProfile("a"));
    db.safeProfiles.push(member("b"));
    await act(async () => { await result.current.fetchProfiles(false, true); });
    expect(result.current.profiles.map(p => p.user_id)).toEqual(["b"]);
    expect(result.current.loading).toBe(false);
  });
});

describe("fromSafeRow", () => {
  it("leaves unknown fields empty instead of inventing them", () => {
    const p = fromSafeRow({ user_id: "u", full_name: "U", role: "Dancer" });
    expect(p.sub_roles).toBeNull();
    expect(p.passion_skills).toBeNull();
    expect(p.collab_intent).toBeNull();
    expect(p.latitude).toBeUndefined();
    expect(p.is_claimed).toBeUndefined();
    expect(p.level).toBe(1);
  });
});
