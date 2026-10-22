import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { SessionsSection } from "@/components/sessions/SessionsSection";

const { auth } = vi.hoisted(() => ({ auth: { user: null as null | { id: string } } }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/utils/eventConfirmationEmail", () => ({ sendEventConfirmationEmail: vi.fn() }));
vi.mock("@/components/sessions/SessionCard", () => ({ SessionCard: () => <div>session card</div> }));
vi.mock("@/components/sessions/CreateSessionDialog", () => ({
  CreateSessionDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">host dialog</div> : null),
}));

// Every read ends in an empty, successful result.
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_target, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) : () => chain),
    apply: () => chain,
  });
  return { supabase: { from: () => chain, rpc: () => chain } };
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <SessionsSection />
    </MemoryRouter>,
  );

describe("SessionsSection", () => {
  beforeEach(() => {
    auth.user = null;
  });

  it("tells a signed-out visitor what the lane needs, with the sign-in and public-events links, and never spins", () => {
    renderSection();
    expect(screen.getByText("Sign in to see events near you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth?next=%2Fdiscover%3Ftab%3Devents");
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/meetup");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /host event/i })).not.toBeInTheDocument();
  });

  it("gives a signed-in person the three lists as pills, with Host Event beside them", async () => {
    auth.user = { id: "u1" };
    renderSection();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Nearby", "Joined", "Hosting"]);
    expect(screen.getByRole("tab", { name: "Nearby" })).toHaveAttribute("data-state", "active");
    await waitFor(() => expect(screen.getByText("No events nearby")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /host event/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("host dialog");
  });

  it("no longer repeats the lane's own title above its pills", () => {
    auth.user = { id: "u1" };
    renderSection();
    expect(screen.queryByText("Events & Sessions")).not.toBeInTheDocument();
  });
});
