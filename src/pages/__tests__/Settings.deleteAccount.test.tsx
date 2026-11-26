import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();
const toast = vi.fn();
const navigate = vi.fn();

// A query builder that resolves to "no row" whatever the page asks for on mount.
const query: Record<string, unknown> = {};
for (const method of ["select", "eq", "order", "limit", "in", "neq", "is"]) query[method] = () => query;
query.maybeSingle = () => Promise.resolve({ data: null, error: null });
query.single = () => Promise.resolve({ data: null, error: { code: "PGRST116" } });
query.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => query,
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { signOut: (...a: unknown[]) => signOut(...a), admin: { deleteUser: (...a: unknown[]) => deleteUser(...a) } },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: (...a: unknown[]) => toast(...a) }) }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navigate }));
const me = { id: "u1", email: "qa@example.test" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me, subscriptionInfo: { subscribed: false, tier: "free" } }) }));
vi.mock("@/hooks/useOnboarding", () => ({ useOnboarding: () => ({ restartOnboarding: vi.fn(), loading: false }) }));
vi.mock("@/hooks/useTrinidadVoice", () => ({ useTrinidadVoice: () => ({ enabled: false, setEnabled: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { pageView: vi.fn() } }));
for (const [path, name] of [
  ["@/components/settings/CreatorSiteSettings", "CreatorSiteSettings"],
  ["@/components/AccountSwitcher", "AccountSwitcher"],
  ["@/components/account/ManualMergeAccountPanel", "ManualMergeAccountPanel"],
  ["@/components/profile/NotificationSettings", "NotificationSettings"],
  ["@/components/settings/BlockedUsersCard", "BlockedUsersCard"],
  ["@/components/settings/TelegramConnectCard", "TelegramConnectCard"],
  ["@/components/LanguageSwitcher", "LanguageSwitcher"],
  ["@/components/onboarding/VibePicker", "VibePicker"],
  ["@/components/brand/KretoScene", "KretoScene"],
  ["@/components/OpenInChrome", "OpenInChrome"],
] as const) {
  vi.doMock(path, () => ({ [name]: () => null }));
}

async function renderSettings() {
  const { default: Settings } = await import("../Settings");
  return render(<MemoryRouter><Settings embedded /></MemoryRouter>);
}

async function confirmDelete() {
  await renderSettings();
  fireEvent.click(await screen.findByRole("button", { name: /^Delete Account$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Yes, delete my account/ }));
}

describe("Settings: Delete Account", () => {
  beforeEach(() => {
    vi.resetModules();
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
