import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { signOut: (...a: unknown[]) => signOut(...a), admin: { deleteUser: (...a: unknown[]) => deleteUser(...a) } } },
}));

import { deleteAccountFailureMessage, deleteOwnAccount } from "../accountDeletion";

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    rpc.mockReset();
    signOut.mockReset();
    deleteUser.mockReset();
  });

  it("asks the server to delete the caller's own account, with no user id from the browser", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    signOut.mockResolvedValue({ error: null });
    await deleteOwnAccount();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
  });

  it("never uses the admin API from the browser", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    signOut.mockResolvedValue({ error: null });
    await deleteOwnAccount();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("clears only the local session after a successful delete (the login no longer exists server-side)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    signOut.mockResolvedValue({ error: null });
    await deleteOwnAccount();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still reports success when clearing the local session throws, because the account is already deleted", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    signOut.mockRejectedValue(new Error("storage unavailable"));
    await expect(deleteOwnAccount()).resolves.toBeUndefined();
  });

  it("throws and does NOT sign out when the server refuses", async () => {
    const refusal = { message: "account_delete_blocked", code: "23503" };
    rpc.mockResolvedValue({ data: null, error: refusal });
    await expect(deleteOwnAccount()).rejects.toBe(refusal);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("throws and does NOT sign out when the function is not installed yet (SQL not applied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function public.delete_my_account", code: "PGRST202" } });
    await expect(deleteOwnAccount()).rejects.toMatchObject({ code: "PGRST202" });
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("deleteAccountFailureMessage", () => {
  it("explains a blocked delete and points to support", () => {
    expect(deleteAccountFailureMessage({ message: "account_delete_blocked" })).toMatch(/contact support/i);
    expect(deleteAccountFailureMessage({ message: "account_delete_blocked" })).toMatch(/records/i);
  });

  it("asks for a fresh sign-in when the session is no longer valid", () => {
    expect(deleteAccountFailureMessage({ message: "not_authenticated" })).toMatch(/sign in again/i);
    expect(deleteAccountFailureMessage({ message: "account_not_found" })).toMatch(/sign in again/i);
  });

  it("never echoes raw database text for anything else", () => {
    const message = deleteAccountFailureMessage({ message: 'permission denied for table "wallets"', code: "42501" });
    expect(message).not.toMatch(/wallets|permission denied|42501/);
    expect(message).toMatch(/contact support/i);
    expect(deleteAccountFailureMessage(null)).toMatch(/contact support/i);
    expect(deleteAccountFailureMessage("boom")).toMatch(/contact support/i);
  });
});
