import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

/**
 * Stripe sends the browser back to this page whether or not the payment can be confirmed. "Payment Successful" and
 * "subscription is now active" are for a verification that worked and a paid plan on the profile, nothing else.
 */
let syncError: unknown = null;
let tier: string | null = "pro";
const invoke = vi.fn(async () => ({ data: {}, error: syncError }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    functions: { invoke: (...a: unknown[]) => (invoke as unknown as (...x: unknown[]) => unknown)(...a) },
    from: () => { const c: Record<string, unknown> = {}; c.select = () => c; c.eq = () => c; c.single = async () => ({ data: { subscription_tier: tier } }); return c; },
  },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { subscriptionStart: vi.fn() } }));

import PaymentSuccess from "../PaymentSuccess";

const run = async () => {
  render(<MemoryRouter><PaymentSuccess /></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
};

beforeEach(() => { vi.useFakeTimers(); syncError = null; tier = "pro"; invoke.mockClear(); vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("PaymentSuccess", () => {
  it("announces success only when the subscription check worked and the profile has a paid tier", async () => {
    await run();
    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    expect(screen.getByText(/subscription is now active/i)).toBeInTheDocument();
  });

  it("a failed subscription check is not an active plan", async () => {
    syncError = new Error("stripe unreachable");
    await run();
    expect(screen.queryByText("Payment Successful!")).not.toBeInTheDocument();
    expect(screen.queryByText(/now active/i)).not.toBeInTheDocument();
    expect(screen.getByText("We could not confirm your payment yet")).toBeInTheDocument();
  });

  it("a profile that is still on the free tier is not an active plan either", async () => {
    tier = "free";
    await run();
    expect(screen.getByText("We could not confirm your payment yet")).toBeInTheDocument();
  });

  it("Check again verifies again and shows success once it is confirmed", async () => {
    syncError = new Error("stripe unreachable");
    await run();
    syncError = null;
    fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
