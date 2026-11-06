import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { describeTestPush, readTestPushAnswer, sendTestPush } from "../pushTest";

describe("readTestPushAnswer: what the server's answer does and does not prove", () => {
  it("a push service that accepted the message is 'accepted', with the counts", () => {
    expect(readTestPushAnswer(null, { success: true, sent: 1, total: 2, removed: 0 })).toEqual({ kind: "accepted", sent: 1, total: 2, removed: 0 });
  });

  it("no device accepted it: refused, never reported as sent", () => {
    expect(readTestPushAnswer(null, { success: true, sent: 0, total: 2, removed: 1 })).toEqual({ kind: "refused", total: 2, removed: 1 });
  });

  it("an account with no registered device says so", () => {
    expect(readTestPushAnswer(null, { success: false, message: "No subscriptions" })).toEqual({ kind: "not-registered" });
  });

  it("an error, or an answer it does not understand, is 'unreachable' and never a success", () => {
    expect(readTestPushAnswer({ message: "boom" }, null)).toEqual({ kind: "unreachable" });
    expect(readTestPushAnswer(null, { success: false, error: "VAPID keys not configured" })).toEqual({ kind: "unreachable" });
    expect(readTestPushAnswer(null, undefined)).toEqual({ kind: "unreachable" });
    expect(readTestPushAnswer(null, { success: true, sent: "many", total: -3 })).toEqual({ kind: "refused", total: 0, removed: 0 });
  });
});

describe("describeTestPush: provider acceptance is not device receipt", () => {
  it("never says delivered or received for an accepted message, and sends the person to their own screen", () => {
    const message = describeTestPush({ kind: "accepted", sent: 1, total: 1, removed: 0 });
    expect(message.tone).toBe("ok");
    expect(message.text).toMatch(/accepted the test for 1 of 1 device\./);
    expect(message.text).toMatch(/not the same as your device showing it/);
    expect(message.text).not.toMatch(/delivered|received/i);
  });

  it("pluralises and mentions devices that were dropped", () => {
    const message = describeTestPush({ kind: "accepted", sent: 2, total: 3, removed: 1 });
    expect(message.text).toContain("2 of 3 devices");
    expect(message.text).toMatch(/1 device that no longer receive notifications was removed/);
  });

  it("gives an actionable line for every failure", () => {
    expect(describeTestPush({ kind: "refused", total: 2, removed: 0 })).toMatchObject({ tone: "error" });
    expect(describeTestPush({ kind: "not-registered" }).text).toMatch(/Turn notifications on/);
    expect(describeTestPush({ kind: "unreachable" }).text).toMatch(/couldn't reach/);
  });
});

describe("sendTestPush", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("notifies only the signed-in member, through the same function, with one test slot and no in-app row", async () => {
    invoke.mockResolvedValue({ data: { success: true, sent: 1, total: 1 }, error: null });
    await expect(sendTestPush("me")).resolves.toMatchObject({ kind: "accepted" });
    expect(invoke).toHaveBeenCalledTimes(1);
    const [name, options] = invoke.mock.calls[0];
    expect(name).toBe("send-push-notification");
    expect(options.body).toMatchObject({ userId: "me", tag: "push-test", data: { link: "/settings" } });
  });

  it("a thrown error is 'unreachable'", async () => {
    invoke.mockRejectedValue(new Error("network"));
    await expect(sendTestPush("me")).resolves.toEqual({ kind: "unreachable" });
  });
});
