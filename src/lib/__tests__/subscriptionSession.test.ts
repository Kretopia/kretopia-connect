import { describe, expect, it, vi } from "vitest";
import { validatedSubscriptionToken } from "../subscriptionSession";

function client(session: any, user: any = { id: "owner" }, error: unknown = null) {
  return { auth: {
    getSession: vi.fn(async () => ({ data: { session } })),
    getUser: vi.fn(async () => ({ data: { user }, error })),
  } };
}
const session = { access_token: "test-session", user: { id: "owner" } };

describe("subscription session preflight", () => {
  it("does not call the server without a session", async () => {
    const c = client(null);
    expect(await validatedSubscriptionToken(c, "owner")).toBeNull();
    expect(c.auth.getUser).not.toHaveBeenCalled();
  });
  it("rejects a deleted or foreign account even with a cached token", async () => {
    const c = client(session, null, new Error("User from sub claim in JWT does not exist"));
    expect(await validatedSubscriptionToken(c, "owner")).toBeNull();
  });
  it("rejects a token belonging to a different signed-in account", async () => {
    expect(await validatedSubscriptionToken(client(session), "other")).toBeNull();
  });
  it("rejects a server identity different from the requested account", async () => {
    expect(await validatedSubscriptionToken(client(session, { id: "other" }), "owner")).toBeNull();
  });
  it("returns only a token whose owner the server recognizes", async () => {
    expect(await validatedSubscriptionToken(client(session), "owner")).toBe("test-session");
  });
});