import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  user: null as null | { id: string; email?: string },
  error: null as null | { message: string },
  profile: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("https://deno.land/std@0.190.0/http/server.ts", () => ({ serve: (handler: any) => { state.handler = handler; } }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.57.2", () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: state.user }, error: state.error }) },
  from: (...args: any[]) => state.profile(...args),
}) }));
vi.mock("https://esm.sh/stripe@18.5.0", () => ({ default: class { constructor() { state.stripe(); } } }));
vi.mock("../../../../supabase/functions/_shared/stripeEnv.ts", () => ({ resolveStripeSecretKey: () => "test-only" }));
vi.mock("../../../../supabase/functions/_shared/founderActivation.ts", () => ({ FOUNDER_PRODUCT_ID: "founder-test", recoverPendingFounderPurchase: vi.fn() }));

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: () => "test-only" } });
  await import("../../../../supabase/functions/check-subscription/index.ts");
});
beforeEach(() => { state.user = null; state.error = null; vi.clearAllMocks(); });
async function call(auth?: string) {
  if (!state.handler) throw new Error("Missing handler");
  return state.handler(new Request("https://function.example/check-subscription", {
    method: "POST", headers: auth ? { Authorization: auth } : {},
  }));
}

describe("check-subscription authentication", () => {
  it.each([undefined, "Basic invalid", "Bearer "])("returns 401, not 500, for absent/malformed authorization %s", async auth => {
    expect((await call(auth)).status).toBe(401);
    expect(state.profile).not.toHaveBeenCalled();
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it("returns a generic 401 for the reported missing JWT user before any payment work", async () => {
    state.error = { message: "User from sub claim in JWT does not exist" };
    const res = await call("Bearer test-token");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in again to check your subscription.", code: "AUTH_SESSION_INVALID" });
    expect(state.profile).not.toHaveBeenCalled();
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it("does not run subscription work without a server user", async () => {
    expect((await call("Bearer test-token")).status).toBe(401);
    expect(state.profile).not.toHaveBeenCalled();
  });
});