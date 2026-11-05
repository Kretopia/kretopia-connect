import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  taken: false, error: null as unknown, readError: null as unknown,
  saved: { user_id: "owner", username: "new_handle" } as any,
  update: vi.fn(), ilike: vi.fn(), neq: vi.fn(), from: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  state.from(table);
  return {
    select: () => ({ ilike: (...args: unknown[]) => {
      state.ilike(...args);
      return { neq: (...args: unknown[]) => {
        state.neq(...args);
        return { limit: async () => ({ data: state.taken ? [{ user_id: "other" }] : [], error: state.readError }) };
      } };
    } }),
    update: (fields: unknown) => {
      state.update(fields);
      return { eq: () => ({ select: () => ({ single: async () => ({ data: state.saved, error: state.error }) }) }) };
    },
  };
} } }));

import { claimOnboardingUsername, isUsernameConflict, UsernameTakenError } from "../onboardingUsername";

beforeEach(() => {
  vi.clearAllMocks();
  state.taken = false;
  state.error = null;
  state.readError = null;
  state.saved = { user_id: "owner", username: "new_handle" };
});

describe("onboarding username collisions", () => {
  it("does not PATCH a handle already belonging to another user", async () => {
    state.taken = true;
    await expect(claimOnboardingUsername("owner", "new_handle")).rejects.toBeInstanceOf(UsernameTakenError);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.from).toHaveBeenCalledWith("public_profiles_safe");
  });
  it("handles the exact reported constraint when a concurrent claim wins", async () => {
    state.error = { code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_key"' };
    await expect(claimOnboardingUsername("owner", "new_handle")).rejects.toBeInstanceOf(UsernameTakenError);
  });
  it("allows a new choice after a collision and confirms its saved owner", async () => {
    state.taken = true;
    await expect(claimOnboardingUsername("owner", "taken_handle")).rejects.toBeInstanceOf(UsernameTakenError);
    state.taken = false;
    await expect(claimOnboardingUsername("owner", "@New_Handle")).resolves.toBe("new_handle");
    expect(state.update).toHaveBeenCalledWith({ username: "new_handle" });
    expect(state.neq).toHaveBeenCalledWith("user_id", "owner");
    expect(state.ilike).toHaveBeenCalledWith("username", "new\\_handle");
  });
  it("does not classify unrelated unique constraints as handle conflicts", () => {
    expect(isUsernameConflict({ code: "23505", message: 'violates unique constraint "profiles_user_id_key"' })).toBe(false);
  });
  it("does not save when availability could not be checked", async () => {
    state.readError = new Error("Network unavailable");
    await expect(claimOnboardingUsername("owner", "new_handle")).rejects.toThrow("Network unavailable");
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects an update that returns no owner row", async () => {
    state.saved = null;
    await expect(claimOnboardingUsername("owner", "new_handle")).rejects.toThrow("could not be saved");
  });
  it.each(["_edge", "edge_", "admin", "ab", "a".repeat(31)])("rejects invalid or reserved %s before querying", async handle => {
    await expect(claimOnboardingUsername("owner", handle)).rejects.toThrow();
    expect(state.from).not.toHaveBeenCalled();
  });
});