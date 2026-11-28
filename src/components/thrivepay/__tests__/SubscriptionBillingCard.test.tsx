import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  profile: { data: null as unknown, error: null as unknown },
  invoke: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => state.profile }) }) }),
    functions: { invoke: (...a: unknown[]) => state.invoke(...a) },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { SubscriptionBillingCard } from "../SubscriptionBillingCard";

const renderCard = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SubscriptionBillingCard />
  </QueryClientProvider>,
);

beforeEach(() => { state.invoke.mockReset(); state.profile = { data: null, error: null }; });

describe("SubscriptionBillingCard", () => {
  it("says a failed payment is failed, as an alert, and offers to update the payment method", async () => {
    state.profile = { data: { subscription_tier: "pro", subscription_status: "past_due", subscription_end_date: "2027-01-15T00:00:00Z" }, error: null };
    renderCard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/last payment failed/i);
    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByRole("button", { name: /update payment method/i })).toBeInTheDocument();
  });
  it("shows plan, status and period end for an active plan and opens the billing link", async () => {
    state.profile = { data: { subscription_tier: "creator_pro", subscription_status: "active", subscription_end_date: "2027-01-15T00:00:00Z" }, error: null };
    state.invoke.mockResolvedValue({ data: { url: "https://billing.example/portal" }, error: null });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderCard();
    expect(await screen.findByText("Creator +")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/Current period ends/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /manage billing/i }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://billing.example/portal", "_blank", "noopener"));
    open.mockRestore();
  });
  it("never invites a member without a paid plan to manage billing; it points to the plans", async () => {
    state.profile = { data: { subscription_tier: "free", subscription_status: "none", subscription_end_date: null }, error: null };
    renderCard();
    expect(await screen.findByText("No paid plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage billing|update payment/i })).toBeNull();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute("href", "/subscription");
  });
  it("offers a retry when the subscription cannot be read, instead of guessing a plan", async () => {
    state.profile = { data: null, error: { message: "boom" } };
    renderCard();
    expect(await screen.findByText(/couldn't load your subscription/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText("Active")).toBeNull();
  });
});
