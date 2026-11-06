import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  invoke: vi.fn(),
  insert: vi.fn(),
  notifyUser: vi.fn(),
  profile: { full_name: "Alex Rivera" } as { full_name: string } | null,
  profileLookups: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => world.invoke(...args) },
    from: (table: string) => ({
      insert: (row: unknown) => {
        world.insert(table, row);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            world.profileLookups += 1;
            return { data: world.profile, error: null };
          },
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: (...args: unknown[]) => world.notifyUser(...args) }));

import { cosignRequestPath, notifyCosignRequest } from "../cosignNotifications";
import { notifyMessage } from "../pushNotifications";

beforeEach(() => {
  world.invoke.mockReset();
  world.invoke.mockResolvedValue({ data: { success: true }, error: null });
  world.insert.mockReset();
  world.notifyUser.mockReset();
  world.notifyUser.mockResolvedValue(undefined);
  world.profile = { full_name: "Alex Rivera" };
  world.profileLookups = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const pushBody = () => world.invoke.mock.calls.find(([name]) => name === "send-push-notification")![1].body;

describe("a co-sign request reaches the member and opens that request", () => {
  const request = { endorserId: "member-2", requesterId: "member-1", requesterName: "Alex Rivera", projectName: "Autumn Lookbook", token: "tok/1 2" };

  it("sends the in-app notification and the push to the same exact link, not the profile", async () => {
    await notifyCosignRequest(request);
    const link = "/credit-verify?token=tok%2F1%202";
    expect(cosignRequestPath("tok/1 2")).toBe(link);

    expect(world.notifyUser).toHaveBeenCalledTimes(1);
    expect(world.notifyUser.mock.calls[0][0]).toMatchObject({
      userId: "member-2",
      type: "credit_confirmation_request",
      actionUrl: link,
      actionText: "Review request",
    });
    expect(world.notifyUser.mock.calls[0][0].actionUrl).not.toBe("/profile");

    expect(world.invoke).toHaveBeenCalledWith("send-push-notification", expect.anything());
    expect(pushBody()).toMatchObject({
      userId: "member-2",
      title: "Alex Rivera asked you to co-sign a credit",
      body: "Open Kretopia to confirm or decline.",
      data: { type: "cosign_request", link },
      tag: "cosign:tok/1 2", // the same request sent again replaces itself on the device and at the push service
    });
  });

  it("puts nothing about the credit on the device: no project name in the text", async () => {
    await notifyCosignRequest(request);
    const { title, body } = pushBody();
    expect(`${title} ${body}`).not.toContain("Autumn Lookbook");
  });

  it("does not add a second in-app row: the push is delivery only", async () => {
    await notifyCosignRequest(request);
    expect(world.insert).not.toHaveBeenCalled();
  });

  it("falls back to the profile when the request has no token, and names the requester from their profile when the caller did not", async () => {
    await notifyCosignRequest({ ...request, token: null, requesterName: null });
    expect(world.profileLookups).toBe(1);
    expect(world.notifyUser.mock.calls[0][0].actionUrl).toBe("/profile");
    expect(pushBody()).toMatchObject({ title: "Alex Rivera asked you to co-sign a credit", data: { link: "/profile" }, tag: "cosign" });
  });

  it("says 'Someone' rather than guess a name it cannot find", async () => {
    world.profile = null;
    await notifyCosignRequest({ ...request, requesterName: "" });
    expect(pushBody().title).toBe("Someone asked you to co-sign a credit");
  });

  it("never fails the request it follows", async () => {
    world.notifyUser.mockRejectedValue(new Error("rpc down"));
    await expect(notifyCosignRequest(request)).resolves.toBeUndefined();
    world.notifyUser.mockResolvedValue(undefined);
    world.invoke.mockRejectedValue(new Error("function down"));
    await expect(notifyCosignRequest(request)).resolves.toBeUndefined();
  });
});

describe("a direct message reaches the member and opens that conversation", () => {
  it("opens the sender's conversation, replaces an earlier message from them, and keeps the text off the device", async () => {
    await notifyMessage("member-2", "Alex Rivera", "Are you free on Friday? Call me on 555-0100", "member-1");
    expect(pushBody()).toMatchObject({
      userId: "member-2",
      title: "New message from Alex Rivera",
      body: "Open Kretopia to read it.",
      data: { type: "message", link: "/messages?user=member-1" },
      tag: "message:member-1",
    });
    expect(JSON.stringify(pushBody())).not.toContain("555-0100");
    // The in-app row keeps the preview: that is inside the app, behind the member's session.
    expect(world.insert).toHaveBeenCalledWith("notifications", expect.objectContaining({ user_id: "member-2", message: "Are you free on Friday? Call me on 555-0100" }));
  });

  it("still opens the messages page when the sender is not known", async () => {
    await notifyMessage("member-2", "Alex Rivera", "Hi");
    expect(pushBody()).toMatchObject({ data: { link: "/messages" }, tag: "message" });
  });
});

describe("a profile lookup that fails", () => {
  it("does not stop the member being told", async () => {
    world.profile = null;
    const original = world.profileLookups;
    // A lookup that throws (offline, a policy change) is not a reason to drop the notification.
    const { supabase } = await import("@/integrations/supabase/client");
    const spy = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") throw new Error("offline");
      return { insert: async () => ({ error: null }) } as never;
    });
    await notifyCosignRequest({ endorserId: "member-2", requesterId: "member-1", projectName: "Autumn Lookbook", token: "t1" });
    spy.mockRestore();
    expect(world.profileLookups).toBe(original);
    expect(world.notifyUser).toHaveBeenCalledTimes(1);
    expect(pushBody().title).toBe("Someone asked you to co-sign a credit");
  });
});
