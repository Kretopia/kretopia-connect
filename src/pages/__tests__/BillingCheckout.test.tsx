import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const paddle = vi.hoisted(() => ({ init: vi.fn(), callback: null as null | ((e: { name?: string }) => void) }));
vi.mock("@/lib/paddleClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/paddleClient")>("@/lib/paddleClient");
  return { ...actual, initializePaddle: (...a: unknown[]) => { paddle.init(...a); paddle.callback = a[2] as never; return Promise.resolve(); } };
});

import BillingCheckout from "../BillingCheckout";
import { tokenMatchesEnvironment } from "@/lib/paddleClient";

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><BillingCheckout /></MemoryRouter>);

beforeEach(() => { paddle.init.mockReset(); paddle.callback = null; });
afterEach(() => vi.unstubAllEnvs());

describe("tokenMatchesEnvironment", () => {
  it("pairs sandbox with test_ tokens and live with live_ tokens only", () => {
    expect(tokenMatchesEnvironment("test_abc", "sandbox")).toBe(true);
    expect(tokenMatchesEnvironment("live_abc", "live")).toBe(true);
    expect(tokenMatchesEnvironment("live_abc", "sandbox")).toBe(false);
    expect(tokenMatchesEnvironment("test_abc", "live")).toBe(false);
    expect(tokenMatchesEnvironment(undefined, "live")).toBe(false);
    expect(tokenMatchesEnvironment("test_abc", "prod")).toBe(false);
  });
});

describe("BillingCheckout (default payment link)", () => {
  it("without a transaction in the link it explains itself and never loads Paddle", () => {
    renderAt("/billing/checkout");
    expect(screen.getByText(/opens a secure checkout/i)).toBeInTheDocument();
    expect(paddle.init).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/subscription");
  });
  it("refuses to open a checkout when the client token is missing or belongs to another environment", () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "live_x");
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox");
    renderAt("/billing/checkout?_ptxn=txn_01abc");
    expect(screen.getByText(/isn't available yet/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
    expect(paddle.init).not.toHaveBeenCalled();
  });
  it("ignores a malformed transaction parameter", () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test_x");
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox");
    renderAt("/billing/checkout?_ptxn=%3Cscript%3E");
    expect(paddle.init).not.toHaveBeenCalled();
  });
  it("initialises Paddle for a valid link and says honestly when the checkout is closed", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test_x");
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox");
    renderAt("/billing/checkout?_ptxn=txn_01abc");
    expect(screen.getByRole("status")).toHaveTextContent(/opening secure checkout/i);
    await waitFor(() => expect(paddle.init).toHaveBeenCalledWith("sandbox", "test_x", expect.any(Function)));
    act(() => paddle.callback?.({ name: "checkout.closed" }));
    expect(await screen.findByText(/checkout closed/i)).toBeInTheDocument();
    expect(screen.getByText(/changes only after the payment is confirmed/i)).toBeInTheDocument();
  });
});
