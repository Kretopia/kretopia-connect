import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), or: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order"]) chain[method] = () => chain;
  chain.or = (value: string) => { mocks.or(value); return chain; };
  chain.range = (...args: unknown[]) => { mocks.range(...args); return Promise.resolve({ data: [{ user_id: "ux" }], error: null }); };
  return { supabase: { from: (table: string) => { mocks.from(table); return chain; } } };
});
import { searchScoutPeople, scoutSearchTarget } from "../scoutPeopleSearch";
describe("Scout people search", () => {
  it("requires both UX and Designer across public profile fields and reuses the completed read", async () => {
    await searchScoutPeople("UX Designer");
    await searchScoutPeople("UX Designer");
    expect(mocks.from.mock.calls).toEqual([["public_profiles_safe"]]);
    expect(mocks.or).toHaveBeenCalledWith('and(or(full_name.ilike."%UX%",role.ilike."%UX%",bio.ilike."%UX%",location.ilike."%UX%"),or(full_name.ilike."%Designer%",role.ilike."%Designer%",bio.ilike."%Designer%",location.ilike."%Designer%"))');
    expect(mocks.range).toHaveBeenCalledWith(0, 50);
  });
  it("preserves the exact original spelling and accents in navigation", () => {
    expect(scoutSearchTarget("UX Designer")).toBe("/scout?q=UX%20Designer");
    expect(scoutSearchTarget("Créateur & Design")).toBe("/scout?q=Cr%C3%A9ateur%20%26%20Design");
  });
});