import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn();
const update = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: (...a: unknown[]) => { update(...a); return { eq: (...b: unknown[]) => { eq(...b); return { select: () => ({ maybeSingle }) }; } }; } }) },
}));

import { updateOwnProfile } from "../ownProfileWrite";

describe("updateOwnProfile", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    eq.mockReset();
    update.mockReset();
  });

  it("targets only the owner's row and succeeds when that row comes back", async () => {
    maybeSingle.mockResolvedValue({ data: { user_id: "u1" }, error: null });
    await expect(updateOwnProfile("u1", { bio: "Hi" })).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ bio: "Hi" });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("fails visibly when the write matched no row, instead of reporting a silent success", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await updateOwnProfile("u1", { bio: "Hi" });
    expect(result.ok).toBe(false);
  });

  it("passes the database error through", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(updateOwnProfile("u1", {})).resolves.toEqual({ ok: false, message: "permission denied" });
  });
});
