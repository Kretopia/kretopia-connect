import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { mintMeetingCredentials, redeemGuestLink } from "@/lib/callCredentials";

const httpError = (body: unknown) => ({ message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify(body), { status: 403 }) });

beforeEach(() => {
  invoke.mockReset();
});

describe("mintMeetingCredentials", () => {
  it("asks for the room's access with the share token and the name, and says what the call is called", async () => {
    invoke.mockResolvedValue({ data: { token: "t", room_url: "https://x.test/r", title: "Standup", role: "host" }, error: null });
    await expect(mintMeetingCredentials("m1", "share", "Ada")).resolves.toEqual({ token: "t", roomUrl: "https://x.test/r", title: "Standup", isHost: true });
    expect(invoke).toHaveBeenCalledWith("mint-meeting-token", { body: { meeting_id: "m1", share_token: "share", user_name: "Ada" } });
  });

  it("makes a host of the host only, and calls an untitled meeting 'Meeting'", async () => {
    invoke.mockResolvedValue({ data: { token: "t", room_url: "https://x.test/r", role: "guest" }, error: null });
    await expect(mintMeetingCredentials("m1", undefined, undefined)).resolves.toMatchObject({ isHost: false, title: "Meeting" });
    expect(invoke.mock.calls[0][1]).toEqual({ body: { meeting_id: "m1", share_token: undefined, user_name: undefined } });
  });

  it("says why the meeting cannot be opened, in the server's words", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError({ error: "You are not invited to this meeting" }) });
    await expect(mintMeetingCredentials("m1", "share", "Ada")).rejects.toThrow("You are not invited to this meeting");
  });

  it("prefers the answer's own error, and has a plain one when there is nothing else", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "Invalid share token" }, error: null });
    await expect(mintMeetingCredentials("m1", "bad", undefined)).rejects.toThrow("Invalid share token");
    invoke.mockResolvedValueOnce({ data: {}, error: null });
    await expect(mintMeetingCredentials("m1", "share", undefined)).rejects.toThrow("Couldn't load meeting");
  });

  it("does not start a call from an answer with no room", async () => {
    invoke.mockResolvedValue({ data: { token: "t" }, error: null });
    await expect(mintMeetingCredentials("m1", "share", "Ada")).rejects.toThrow("Couldn't load meeting");
  });

  it("surfaces a thrown failure's message", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    await expect(mintMeetingCredentials("m1", "share", "Ada")).rejects.toThrow("offline");
  });
});

describe("redeemGuestLink", () => {
  it("redeems the link for the trimmed name and gives a guest's call: never the host", async () => {
    invoke.mockResolvedValue({ data: { room_url: "https://x.test/g", token: "gt" }, error: null });
    await expect(redeemGuestLink("link", "  Grace  ")).resolves.toEqual({ roomUrl: "https://x.test/g", token: "gt", title: "Live call", isHost: false });
    expect(invoke).toHaveBeenCalledWith("redeem-video-guest-link", { body: { token: "link", guest_name: "Grace" } });
  });

  it("says why a link cannot be used", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError({ error: "Link expired" }) });
    await expect(redeemGuestLink("link", "Grace")).rejects.toThrow("Link expired");
  });

  it("does not start a call from an answer with no room or no token", async () => {
    invoke.mockResolvedValue({ data: { room_url: "https://x.test/g" }, error: null });
    await expect(redeemGuestLink("link", "Grace")).rejects.toThrow("Invalid response");
    invoke.mockResolvedValue({ data: { error: "Invalid link" }, error: null });
    await expect(redeemGuestLink("link", "Grace")).rejects.toThrow("Invalid link");
  });

  it("surfaces a thrown failure's message", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    await expect(redeemGuestLink("link", "Grace")).rejects.toThrow("offline");
  });
});
