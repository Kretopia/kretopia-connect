import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ inserts: [] as { table: string; value: any }[], inviteError: null as null | { message: string }, toast: vi.fn(), email: null as string | null }));
vi.mock("@/hooks/useProjectLimit", () => ({ useProjectLimit: () => ({ canCreateProject: true, limit: 1, isPro: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), EventCategory: { COLLABORATION: "collaboration" } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "sender" } } }) },
  rpc: async (name: string) => ({ data: name === "get_user_email" ? h.email : null }),
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
import { notifyUser } from "@/lib/notifyUser";
import { supabase } from "@/integrations/supabase/client";
beforeEach(() => { h.inserts.length = 0; h.inviteError = null; h.email = null; h.toast.mockReset(); vi.mocked(notifyUser).mockClear(); vi.mocked(supabase.functions.invoke).mockClear(); });
afterEach(cleanup);

const SUMMARY = "A one-minute brand film for Nova's autumn launch, shot over two days in Lisbon.";
const REASON = "Your lighting on the Static Bloom shoot is exactly the look Nova asked for.";

function open() {
  render(<MemoryRouter><StartProjectFromMatchDialog open onOpenChange={() => {}} matchedUser={{ id: "recipient-company", name: "Nova", role: "Brand" }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Custom Project/ }));
  fireEvent.change(screen.getByLabelText(/Project Name/), { target: { value: "Urban Light" } });
}

function writeBrief(summary = SUMMARY, reason = REASON) {
  fireEvent.change(screen.getByLabelText(/What the project is/), { target: { value: summary } });
  fireEvent.change(screen.getByLabelText(/Why this collaboration makes sense/), { target: { value: reason } });
}

async function propose() {
  open();
  writeBrief();
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
describe("a collaboration request carries a real brief", () => {
  const send = () => fireEvent.click(screen.getByRole("button", { name: /Create & invite/ }));
  const nothingWasCreated = () => {
    expect(h.inserts).toEqual([]);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  };

  it("refuses an empty brief, creates nothing, and says what is missing", async () => {
    open();
    send();
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    expect(h.toast.mock.calls[0][0]).toMatchObject({ title: "Add your brief first", variant: "destructive" });
    nothingWasCreated();
    expect(screen.getAllByRole("alert").map((el) => el.textContent).join(" ")).toMatch(/What the project is: required[\s\S]*Why this collaboration makes sense: required/);
  });

  it("refuses a near-empty brief, even with one good field", async () => {
    open();
    writeBrief(SUMMARY, "Great work.");
    send();
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    nothingWasCreated();
    expect(screen.getByRole("alert")).toHaveTextContent(/Why this collaboration makes sense: say a little more/);
  });

  it("does not let a template stand in for the brief", async () => {
    open();
    expect(screen.getByLabelText(/What the project is/)).toHaveValue("");
    send();
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    nothingWasCreated();
  });

  it("sends the brief with the request: the project's description, the notification, and the email", async () => {
    h.email = "nova@example.com";
    await propose();
    expect(h.inserts.find((row) => row.table === "projects")?.value).toMatchObject({ title: "Urban Light", description: SUMMARY });
    const [notification] = vi.mocked(notifyUser).mock.calls[0];
    expect(notification.message).toContain(`The project: ${SUMMARY}`);
    expect(notification.message).toContain(`Why this collaboration: ${REASON}`);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("send-project-invitation", {
      body: expect.objectContaining({ kind: "collaboration_request", brief: { summary: SUMMARY, reason: REASON } }),
    });
  });
});
