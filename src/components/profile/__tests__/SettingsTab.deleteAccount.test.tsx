import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();
const toast = vi.fn();
const navigate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { signOut: (...a: unknown[]) => signOut(...a), admin: { deleteUser: (...a: unknown[]) => deleteUser(...a) } },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: (...a: unknown[]) => toast(...a) }) }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navigate }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: { id: "p1", user_id: "u1" }, userBadge: null }) }));
vi.mock("../ShareableCreatorCard", () => ({ ShareableCreatorCard: () => null }));
vi.mock("../StorageUsageCard", () => ({ StorageUsageCard: () => null }));

import { SettingsTab } from "../SettingsTab";

async function confirmDelete() {
  render(<MemoryRouter><SettingsTab /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /^Delete Account$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Yes, delete my account/ }));
}

describe("SettingsTab: Delete Account", () => {
  beforeEach(() => {
    for (const fn of [rpc, signOut, deleteUser, toast, navigate]) fn.mockReset();
  });

  it("deletes through the server function, never the admin API, then signs out and goes home", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    signOut.mockResolvedValue({ error: null });
    await confirmDelete();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Account deleted" }));
  });

  it("shows the failure toast, stays signed in and stays on the page when the server refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "account_delete_blocked", code: "23503" } });
    await confirmDelete();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to delete account", variant: "destructive" })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Account deleted" }));
    expect(signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("shows the failure toast when the call itself rejects (offline)", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    await confirmDelete();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to delete account" })));
    expect(signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
