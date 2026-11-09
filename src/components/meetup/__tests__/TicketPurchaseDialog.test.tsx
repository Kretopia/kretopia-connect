import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: mocks.from,
  },
}));

import { TicketPurchaseDialog } from "../TicketPurchaseDialog";

describe("TicketPurchaseDialog", () => {
  it("shows real tier details but cannot claim or pay before atomic reservation support exists", async () => {
    mocks.invoke.mockReset();
    mocks.from.mockImplementation(() => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{
            id: "free-tier",
            name: "Community",
            description: null,
            price: 0,
            currency: "USD",
            quantity_total: 20,
            quantity_sold: 0,
            sale_starts_at: null,
            sale_ends_at: null,
            min_per_order: 1,
            max_per_order: 2,
            is_hidden: false,
          }],
          error: null,
        }),
      };
      return query;
    });

    render(
      <TicketPurchaseDialog
        open
        onOpenChange={() => {}}
        eventId="event-1"
        eventTitle="Studio night"
      />,
    );

    expect(await screen.findByText("Reservations are unavailable")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Free tier")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim free ticket|^pay /i })).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
