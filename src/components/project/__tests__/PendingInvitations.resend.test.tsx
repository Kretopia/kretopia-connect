import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingInvitations } from "../PendingInvitations";

// The send function answers 200 even when the email did not leave; the toast must follow `emailSent`.
const h = vi.hoisted(() => ({ invoke: vi.fn(), toast: vi.fn() }));
const pending = { id: "c1", status: "pending", email: "ann@example.com", user_id: null, invited_at: "2026-10-21T02:00:00Z", agent_role: "creative", projects: { id: "p1", title: "Studio" }, inviter: null };

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "or", "in", "order", "update", "delete"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: { full_name: "Noé" }, error: null });
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    return q;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: (table: string) => chain(table === "project_collaborators" ? [pending] : []),
      channel: () => channel,
      removeChannel: vi.fn(),
      functions: { invoke: h.invoke },
    },
  };
});

beforeEach(() => { h.invoke.mockReset(); h.toast.mockReset(); });
afterEach(cleanup);

const resend = async () => {
  render(<PendingInvitations projectId="p1" />);
  fireEvent.click(await screen.findByRole("button", { name: /Resend/ }));
  await waitFor(() => expect(h.toast).toHaveBeenCalled());
  return h.toast.mock.calls[0][0];
};

describe("resending an invitation email", () => {
  it("says it was resent when the email left", async () => {
    h.invoke.mockResolvedValue({ data: { success: true, emailSent: true }, error: null });
    const toast = await resend();
    expect(toast.title).toBe("Invite resent");
    expect(toast.variant).toBeUndefined();
  });

  it("says it was NOT sent when the function answered 200 with emailSent false", async () => {
    h.invoke.mockResolvedValue({ data: { success: true, emailSent: false, emailError: "x" }, error: null });
    const toast = await resend();
    expect(toast.title).toBe("Email not sent");
    expect(toast.variant).toBe("destructive");
    expect(toast.description).toContain("ann@example.com");
  });

  it("does not claim success when the answer has no body", async () => {
    h.invoke.mockResolvedValue({ data: null, error: null });
    expect((await resend()).title).toBe("Email not sent");
  });

  it("still reports a failed call as an error", async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error("boom") });
    const toast = await resend();
    expect(toast.title).toBe("Couldn't resend");
    expect(toast.variant).toBe("destructive");
  });
});
