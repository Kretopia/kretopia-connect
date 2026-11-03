import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ inserts: [] as { table: string; value: unknown }[], toast: vi.fn(), auth: { user: { id: "sender" }, loading: false } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => h.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ error: null }) },
    from: (table: string) => {
      const rows =
        table === "projects"
          ? [{ id: "p1", title: "Neon Nights", status: "active", description: "A four-minute music video for Maya Rios's single, shot over two nights in Lisbon." }]
          : table === "profiles"
            ? { full_name: "Sender Name" }
            : [];
      const q: Record<string, unknown> = {};
      q.select = q.eq = q.order = q.in = () => q;
      q.insert = (value: unknown) => {
        h.inserts.push({ table, value });
        return Promise.resolve({ error: null });
      };
      q.maybeSingle = async () => ({ data: rows });
      q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
      return q;
    },
  },
}));

import { InviteToProjectDialog } from "../InviteToProjectDialog";
import { notifyUser } from "@/lib/notifyUser";
import { supabase } from "@/integrations/supabase/client";

beforeEach(() => {
  h.inserts.length = 0;
  h.toast.mockReset();
  vi.mocked(notifyUser).mockClear();
  vi.mocked(supabase.functions.invoke).mockClear();
});
afterEach(cleanup);

const REASON = "Your handheld night work on Static Bloom is exactly the look Maya wants for this one.";

async function openAndChooseProject() {
  render(<InviteToProjectDialog open onOpenChange={() => {}} recipientUserId="maya" recipientName="Maya Rios" />);
  fireEvent.click(await screen.findByRole("button", { name: /Neon Nights/ }));
}

describe("inviting someone to an existing project", () => {
  it("asks for the brief once a project is chosen, starting from the project's own description", async () => {
    await openAndChooseProject();
    expect(screen.getByLabelText(/What the project is/)).toHaveValue("A four-minute music video for Maya Rios's single, shot over two nights in Lisbon.");
    expect(screen.getByLabelText(/Why this collaboration makes sense/)).toHaveValue("");
  });

  it("will not send without the second half of the brief", async () => {
    await openAndChooseProject();
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    expect(h.toast.mock.calls[0][0]).toMatchObject({ title: "Add your brief first", variant: "destructive" });
    expect(h.inserts.filter((row) => row.table === "project_collaborators")).toEqual([]);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Why this collaboration makes sense: required/);
  });

  it("sends the invitation with the brief in the notification and in the email request", async () => {
    await openAndChooseProject();
    fireEvent.change(screen.getByLabelText(/Why this collaboration makes sense/), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalled());

    expect(h.inserts.find((row) => row.table === "project_collaborators")?.value).toMatchObject({ user_id: "maya", invited_by: "sender", status: "pending" });
    const [notification] = vi.mocked(notifyUser).mock.calls[0];
    expect(notification.message).toContain(`Why this collaboration: ${REASON}`);
    expect(notification.message).toContain("The project: A four-minute music video");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("send-project-invitation", {
      body: expect.objectContaining({ kind: "collaboration_request", brief: { summary: expect.stringContaining("four-minute music video"), reason: REASON } }),
    });
  });
});
