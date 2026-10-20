import { describe, expect, it, vi } from "vitest";
import { mintGuestInviteToken } from "@/lib/guestInviteToken";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const client = (result: unknown) => ({ rpc: vi.fn().mockImplementation(async () => result) });

describe("mintGuestInviteToken", () => {
  it("sends the secret from the emailed link", async () => {
    const c = client({ data: "tok", error: null });
    expect(await mintGuestInviteToken(c, PROJECT, "a@b.co", "s3cret")).toBe("tok");
    expect(c.rpc).toHaveBeenCalledWith("get_or_create_guest_token_for_invite", { _project_id: PROJECT, _email: "a@b.co", _secret: "s3cret" });
  });

  it("sends no secret argument when the link has none (older invitations)", async () => {
    const c = client({ data: "tok", error: null });
    await mintGuestInviteToken(c, PROJECT, "a@b.co", null);
    await mintGuestInviteToken(c, PROJECT, "a@b.co");
    expect(c.rpc.mock.calls.map((call) => call[1])).toEqual([
      { _project_id: PROJECT, _email: "a@b.co" },
      { _project_id: PROJECT, _email: "a@b.co" },
    ]);
  });

  it("returns null when the server refuses, errors or throws", async () => {
    expect(await mintGuestInviteToken(client({ data: null, error: null }), PROJECT, "a@b.co", "x")).toBeNull();
    expect(await mintGuestInviteToken(client({ data: null, error: { message: "boom" } }), PROJECT, "a@b.co", "x")).toBeNull();
    expect(await mintGuestInviteToken({ rpc: () => { throw new Error("network"); } }, PROJECT, "a@b.co", "x")).toBeNull();
  });
});
