import { supabase } from "@/integrations/supabase/client";

/**
 * A test notification the member sends to their own devices, to see for themselves that notifications reach a real phone.
 *
 * What the server can tell us is only that a push service ACCEPTED the message for a device (an HTTP 2xx). That is not the same as
 * the device showing it, and nothing in the browser or the server can observe the lock screen. The wording below keeps the two
 * apart, so a green "accepted" is never read as "delivered": the person looking at their phone is the proof.
 */
export type TestPushOutcome =
  | { kind: "unreachable" }
  | { kind: "not-registered" }
  | { kind: "refused"; total: number; removed: number }
  | { kind: "accepted"; sent: number; total: number; removed: number };

export interface TestPushMessage {
  tone: "ok" | "warn" | "error";
  text: string;
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
const devices = (n: number) => `${n} device${n === 1 ? "" : "s"}`;

/** Reads the answer of `send-push-notification`. Exported for tests. */
export function readTestPushAnswer(error: unknown, data: unknown): TestPushOutcome {
  if (error) return { kind: "unreachable" };
  const body = (data && typeof data === "object" ? data : {}) as { success?: boolean; message?: string; sent?: unknown; total?: unknown; removed?: unknown };
  if (body.success === false && body.message === "No subscriptions") return { kind: "not-registered" };
  if (body.success !== true) return { kind: "unreachable" };
  const sent = count(body.sent);
  const total = count(body.total);
  const removed = count(body.removed);
  return sent > 0 ? { kind: "accepted", sent, total, removed } : { kind: "refused", total, removed };
}

export function describeTestPush(outcome: TestPushOutcome): TestPushMessage {
  switch (outcome.kind) {
    case "accepted": {
      const expired = outcome.removed > 0 ? ` ${devices(outcome.removed)} that no longer receive notifications ${outcome.removed === 1 ? "was" : "were"} removed.` : "";
      return {
        tone: "ok",
        text:
          `The push service accepted the test for ${outcome.sent} of ${devices(outcome.total)}. That is not the same as your device showing it: ` +
          `look at the lock screen or the notification list. If nothing appears within a minute, check that device's notification settings.${expired}`,
      };
    }
    case "refused":
      return {
        tone: "error",
        text:
          `The push service did not accept the test for any of your ${devices(outcome.total)}. ` +
          `On the device you want to test, turn notifications off and on again here, then retry.`,
      };
    case "not-registered":
      return { tone: "warn", text: "No device is registered for your account yet. Turn notifications on from the device you want to test, then send the test." };
    default:
      return { tone: "error", text: "We couldn't reach the notification service. Check your connection and try again." };
  }
}

/**
 * Sends the test to the signed-in member's own devices (the server only trusts a member notifying themselves here). It creates no
 * in-app notification and goes through the same function and the same encrypted path as every real notification.
 */
export async function sendTestPush(userId: string): Promise<TestPushOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId,
        title: "Kretopia test notification",
        body: "If you can read this, notifications reach this device.",
        // One slot on the device and at the push service: pressing the button again replaces the test, it does not pile up.
        tag: "push-test",
        data: { type: "general", link: "/settings" },
      },
    });
    return readTestPushAnswer(error, data);
  } catch {
    return { kind: "unreachable" };
  }
}
