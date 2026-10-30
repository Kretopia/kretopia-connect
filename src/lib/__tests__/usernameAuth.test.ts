import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getUser: vi.fn(), setSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: state } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.getUser.mockResolvedValue({ data: { user: { id: "owner", email: "test@example.test" } }, error: null });
});

describe("optional username linking", () => {
  it("does not send an invalid session to username-auth", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    state.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid session" } });
    const { linkUsernameLogin } = await import("../usernameAuth");
    await expect(linkUsernameLogin("invalid-test-token")).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });
  it("does nothing without a token", async () => {
    const { linkUsernameLogin } = await import("../usernameAuth");
    await linkUsernameLogin(null);
    expect(state.getUser).not.toHaveBeenCalled();
  });
  it("records only a successful link and does not duplicate it", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ linked: true }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const { linkUsernameLogin } = await import("../usernameAuth");
    await linkUsernameLogin("valid-test-token");
    await linkUsernameLogin("valid-test-token");
    expect(request).toHaveBeenCalledTimes(1);
    expect(state.getUser).toHaveBeenCalledWith("valid-test-token");
  });
  it("allows retry after a server refusal instead of marking the token linked", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ linked: true }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const { linkUsernameLogin } = await import("../usernameAuth");
    await linkUsernameLogin("retry-test-token");
    await linkUsernameLogin("retry-test-token");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("network failures do not interrupt sign-in and remain retryable", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", request);
    const { linkUsernameLogin } = await import("../usernameAuth");
    await expect(linkUsernameLogin("network-test-token")).resolves.toBeUndefined();
    await expect(linkUsernameLogin("network-test-token")).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });
});