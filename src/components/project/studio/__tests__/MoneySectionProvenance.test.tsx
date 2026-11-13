import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Studio money section tells whoever looks at a paid invoice whose word it rests on: a payment provider's, or the
// issuer's own record (confirm_invoice_paid_manually). See src/lib/invoiceProvenance.ts.
const state = vi.hoisted(() => ({ invoice: null as Record<string, unknown> | null, viewer: "client-1", select: "" }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: state.viewer } }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: (cols: string) => ((state.select = cols), chain),
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: state.invoice, error: null }),
  };
  return { supabase: { from: () => chain, rpc: vi.fn() } };
});

import { MoneySection } from "../MoneySection";

const project = { id: "proj-1", client_price: 1200, currency: "USD" };
const show = (props: Partial<{ isOwner: boolean; clientView: boolean }> = {}) =>
  render(<MoneySection project={project} isOwner={false} clientView={false} onOpenInvoice={() => {}} {...props} />);

beforeEach(() => {
  state.viewer = "client-1";
  state.select = "";
});

describe("MoneySection: who vouches for Paid", () => {
  it("tells someone other than the issuer that the issuer recorded it", async () => {
    state.invoice = { id: "inv-1", status: "paid", total_amount: 1200, issued_by: "owner-1" };
    show({ clientView: true });
    const note = await screen.findByText("· recorded by the issuer");
    expect(note).toHaveAttribute("title", "Recorded by the issuer; no payment provider confirmed it");
    // Read with "*": naming the provider reference column fails until its migration is applied.
    expect(state.select).toBe("*");
  });

  it("reminds the issuer it is their own record", async () => {
    state.viewer = "owner-1";
    state.invoice = { id: "inv-1", status: "paid", total_amount: 1200, issued_by: "owner-1" };
    show({ isOwner: true });
    expect(await screen.findByText("· self-reported")).toBeInTheDocument();
  });

  it("adds nothing when a payment provider confirmed it", async () => {
    state.invoice = { id: "inv-1", status: "paid", total_amount: 1200, issued_by: "owner-1", stripe_payment_intent_id: "pi_1" };
    show({ clientView: true });
    expect(await screen.findByText("Paid — thank you")).toBeInTheDocument();
    expect(screen.queryByText(/recorded by the issuer|self-reported/)).not.toBeInTheDocument();
  });
});
