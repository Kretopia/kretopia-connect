import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ inserts: [] as { table: string; value: any }[], inviteError: null as null | { message: string }, toast: vi.fn() }));
vi.mock("@/hooks/useProjectLimit", () => ({ useProjectLimit: () => ({ canCreateProject: true, limit: 1, isPro: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), EventCategory: { COLLABORATION: "collaboration" } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "sender" } } }) },
  rpc: async () => ({ data: null }),
  functions: { invoke: vi.fn().mockResolvedValue({ error: null }) },
  from: (table: string) => {
    const q: any = {};
    q.insert = (value: any) => { h.inserts.push({ table, value }); return q; };
    q.select = q.eq = () => q;
    q.single = async () => ({ data: table === "projects" ? { id: "project-1" } : { full_name: "Sender" }, error: null });
    q.then = (resolve: any) => Promise.resolve({ error: table === "project_collaborators" ? h.inviteError : null }).then(resolve);
    return q;
  },
} }));

import { StartProjectFromMatchDialog } from "../StartProjectFromMatchDialog";
beforeEach(() => { h.inserts.length = 0; h.inviteError = null; h.toast.mockReset(); });
afterEach(cleanup);

async function propose() {
  render(<MemoryRouter><StartProjectFromMatchDialog open onOpenChange={() => {}} matchedUser={{ id: "recipient-company", name: "Nova", role: "Brand" }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Custom Project/ }));
  fireEvent.change(screen.getByLabelText(/Project Name/), { target: { value: "Urban Light" } });
  fireEvent.click(screen.getByRole("button", { name: /Create & invite/ }));
  await waitFor(() => expect(h.toast).toHaveBeenCalled());
}

describe("project proposal consent", () => {
  it("invites the concerned company as pending, never automatically accepted", async () => {
    await propose();
    expect(h.inserts.find((row) => row.table === "project_collaborators")?.value).toMatchObject({ user_id: "recipient-company", invited_by: "sender", status: "pending", role: "member" });
    expect(h.inserts.filter((row) => row.table === "project_collaborators")).toHaveLength(1);
  });
  it("does not report an invitation as sent when it failed", async () => {
    h.inviteError = { message: "Denied" };
    await propose();
    expect(h.toast.mock.calls[0][0]).toMatchObject({ title: "Project saved — invitation not sent", variant: "destructive" });
  });
});