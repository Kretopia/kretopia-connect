/* eslint-disable @typescript-eslint/no-explicit-any -- fakes of the browser's Push API and of the query builder are loosely typed on purpose */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Turning notifications on has to be honest and has to stay bound to the right account. These tests drive the real
// lib/pushSubscription.ts against a fake browser (service worker, Push API, Notification) and an in-memory push_subscriptions table.
const world = vi.hoisted(() => ({
  standalone: true,
  order: [] as string[],
  registration: null as any,
  rows: [] as any[],
  upserts: [] as any[],
  failSelect: false,
  failUpsert: false,
  failDelete: false,
  session: { user: { id: "member-1" } } as any,
}));

vi.mock("@/lib/serviceWorker", () => ({
  isStandalonePWA: () => world.standalone,
  ensureAppServiceWorkerRegistered: async () => (world.order.push("register"), world.registration),
  getAppServiceWorkerRegistration: async () => world.registration,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: world.session } }) },
    from: () => {
      const filters: Record<string, unknown> = {};
      let op: "select" | "upsert" | "delete" = "select";
      let upsert: { row: any; options: any } | null = null;
      const run = (): { data: any; error: any } => {
        if (op === "upsert") {
          world.upserts.push(upsert);
          if (world.failUpsert) return { data: null, error: { message: "row-level security" } };
          const row = upsert!.row;
          const existing = world.rows.find((r) => r.user_id === row.user_id && r.endpoint === row.endpoint);
          if (existing) Object.assign(existing, row);
          else world.rows.push({ id: `row-${world.rows.length + 1}`, ...row });
          return { data: { id: (existing ?? world.rows[world.rows.length - 1]).id }, error: null };
        }
        if (op === "delete") {
          if (world.failDelete) return { data: null, error: { message: "offline" } };
          world.rows = world.rows.filter((r) => !Object.entries(filters).every(([k, v]) => r[k] === v));
          return { data: null, error: null };
        }
        if (world.failSelect) return { data: null, error: { message: "offline" } };
        const found = world.rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: found ? { id: found.id } : null, error: null };
      };
      const chain: any = {
        select: () => chain,
        upsert: (row: any, options: any) => ((op = "upsert"), (upsert = { row, options }), chain),
        delete: () => ((op = "delete"), chain),
        eq: (k: string, v: unknown) => ((filters[k] = v), chain),
        maybeSingle: async () => run(),
        then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
      };
      return chain;
    },
  },
}));

import {
  describePushAvailability,
  describePushFailure,
  disablePush,
  enablePush,
  getPushAvailability,
  releasePushForSignOut,
  syncPushSubscription,
} from "../pushSubscription";

// A 65-byte uncompressed P-256 point, as a server key is.
const serverKeyBytes = new Uint8Array(65).fill(7);
serverKeyBytes[0] = 4;
const SERVER_KEY = Buffer.from(serverKeyBytes).toString("base64url");
const OTHER_KEY = new Uint8Array(65).fill(9).buffer;

let current: any = null;
let created = 0;
const buffer = (length: number, fill: number) => new Uint8Array(length).fill(fill).buffer;

function makeSubscription(endpoint: string, serverKey: ArrayBuffer) {
  const subscription: any = {
    endpoint,
    options: { applicationServerKey: serverKey },
    getKey: (name: string) => (name === "p256dh" ? buffer(65, 5) : name === "auth" ? buffer(16, 3) : null),
    unsubscribe: vi.fn(async () => {
      if (current === subscription) current = null;
      return true;
    }),
  };
  return subscription;
}

const notification = { permission: "default" as NotificationPermission, requestPermission: vi.fn() };
const asUserAgent = (userAgent: string, platform = "Linux armv8l") => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
};
const originalUserAgent = navigator.userAgent;
const originalPlatform = navigator.platform;

beforeEach(() => {
  world.standalone = true;
  world.order = [];
  world.rows = [];
  world.upserts = [];
  world.failSelect = world.failUpsert = world.failDelete = false;
  world.session = { user: { id: "member-1" } };
  current = null;
  created = 0;

  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async (options: { applicationServerKey: Uint8Array }) => {
      world.order.push("subscribe");
      current = makeSubscription(`https://fcm.googleapis.com/fcm/send/new-${++created}`, options.applicationServerKey.buffer as ArrayBuffer);
      return current;
    }),
  };
  world.registration = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve(world.registration) } });
  vi.stubGlobal("PushManager", class {});
  notification.permission = "default";
  notification.requestPermission = vi.fn(async () => {
    world.order.push("permission");
    notification.permission = "granted";
    return "granted" as NotificationPermission;
  });
  vi.stubGlobal("Notification", notification);
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", SERVER_KEY);
  asUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  asUserAgent(originalUserAgent, originalPlatform);
});

describe("can this device receive notifications", () => {
  it("is ready in the installed app with a server key and no refusal", () => {
    expect(getPushAvailability()).toBe("ready");
  });

  it("says why not, instead of one vague 'unsupported'", () => {
    world.standalone = false;
    expect(getPushAvailability()).toBe("install"); // browser tabs clear the worker at start (main.tsx)

    asUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "iPhone");
    expect(getPushAvailability()).toBe("ios-install");
    world.standalone = true;
    expect(getPushAvailability()).toBe("ready"); // the Home Screen app on iOS

    asUserAgent(originalUserAgent, originalPlatform);
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    expect(getPushAvailability()).toBe("not-configured");
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", SERVER_KEY);

    notification.permission = "denied";
    expect(getPushAvailability()).toBe("blocked");
    notification.permission = "default";

    delete (globalThis as any).PushManager; // a browser without the Push API
    expect(getPushAvailability()).toBe("unsupported");
  });

  it("has a sentence for every state a member can be in", () => {
    for (const state of ["install", "ios-install", "not-configured", "blocked", "unsupported"] as const) {
      const text = describePushAvailability(state);
      expect(text.title.length).toBeGreaterThan(5);
      expect(text.description.length).toBeGreaterThan(20);
    }
    for (const reason of ["unavailable", "not-configured", "blocked", "dismissed", "failed"] as const) {
      expect(describePushFailure(reason).description.length).toBeGreaterThan(20);
    }
  });
});

describe("turning notifications on", () => {
  it("asks for the permission first, then subscribes with the server key, stores the keys and reads them back", async () => {
    const result = await enablePush("member-1");
    expect(result).toEqual({ ok: true });
    // The prompt comes before the worker is touched: browsers only show it while the tap is the active gesture.
    expect(world.order).toEqual(["permission", "register", "subscribe"]);
    expect(world.registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: serverKeyBytes });
    expect(world.upserts).toHaveLength(1);
    expect(world.upserts[0].options).toEqual({ onConflict: "user_id,endpoint" });
    expect(world.upserts[0].row).toMatchObject({
      user_id: "member-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/new-1",
      p256dh: Buffer.from(new Uint8Array(65).fill(5)).toString("base64"),
      auth: Buffer.from(new Uint8Array(16).fill(3)).toString("base64"),
    });
    expect(world.rows).toHaveLength(1);
    expect(await syncPushSubscription("member-1")).toBe("on");
  });

  it("does not ask for a permission it cannot use: not set up, or already blocked", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "not-configured" });
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", SERVER_KEY);
    notification.permission = "denied";
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "blocked" });
    world.standalone = false;
    notification.permission = "default";
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "unavailable" });
    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(world.rows).toHaveLength(0);
  });

  it("stores nothing when the member refuses or closes the prompt", async () => {
    notification.requestPermission = vi.fn(async () => "denied" as NotificationPermission);
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "blocked" });
    notification.requestPermission = vi.fn(async () => "default" as NotificationPermission);
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "dismissed" });
    expect(world.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(world.rows).toHaveLength(0);
  });

  it("is not 'on' when the server did not store it, and leaves no half-registered subscription behind", async () => {
    world.failUpsert = true;
    expect(await enablePush("member-1")).toEqual({ ok: false, reason: "failed" });
    expect(current).toBeNull(); // the subscription made for this attempt was dropped
    expect(world.rows).toHaveLength(0);
    expect(await syncPushSubscription("member-1")).toBe("off");
  });

  it("reuses this member's own subscription instead of making another", async () => {
    await enablePush("member-1");
    const first = current;
    expect(await enablePush("member-1")).toEqual({ ok: true });
    expect(current).toBe(first);
    expect(world.registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(world.rows).toHaveLength(1); // one row, not two: the same device is never stored twice
  });

  it("starts from a new endpoint when the browser's subscription is someone else's (a shared device)", async () => {
    // Account A left a subscription on this device and its row belongs to A. B turns notifications on.
    current = makeSubscription("https://fcm.googleapis.com/fcm/send/left-by-a", serverKeyBytes.buffer as ArrayBuffer);
    const leftByA = current;
    world.rows.push({ id: "row-a", user_id: "member-a", endpoint: leftByA.endpoint });

    expect(await enablePush("member-b")).toEqual({ ok: true });
    expect(leftByA.unsubscribe).toHaveBeenCalled();
    expect(current.endpoint).not.toBe(leftByA.endpoint);
    // B's row points at the new endpoint only: A's notifications can no longer reach B's session through the old one.
    expect(world.rows.filter((r) => r.user_id === "member-b").map((r) => r.endpoint)).toEqual([current.endpoint]);
  });

  it("replaces a subscription made with a different server key, which could never be delivered to", async () => {
    current = makeSubscription("https://fcm.googleapis.com/fcm/send/old-key", OTHER_KEY);
    const old = current;
    world.rows.push({ id: "row-1", user_id: "member-1", endpoint: old.endpoint });
    expect(await enablePush("member-1")).toEqual({ ok: true });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(current.endpoint).not.toBe(old.endpoint);
  });
});

describe("what the toggle shows", () => {
  it("is off without a permission or a subscription", async () => {
    expect(await syncPushSubscription("member-1")).toBe("off");
    notification.permission = "granted";
    expect(await syncPushSubscription("member-1")).toBe("off");
  });

  it("registers again a subscription the server lost, but only for a member who enabled notifications on this device", async () => {
    await enablePush("member-1");
    world.rows = []; // pruned after the push service reported the old endpoint gone, say
    expect(await syncPushSubscription("member-1")).toBe("on");
    expect(world.rows).toHaveLength(1);

    // Another member opens the app on the same device: they never turned notifications on here, so nothing is inherited.
    expect(await syncPushSubscription("member-2")).toBe("off");
    expect(world.rows.some((r) => r.user_id === "member-2")).toBe(false);
  });

  it("drops a subscription another account left on the device, so it stops delivering that account's notifications here", async () => {
    // Account A's session expired without a sign-out: the browser still holds A's subscription and the server still has A's row.
    current = makeSubscription("https://fcm.googleapis.com/fcm/send/left-by-a", serverKeyBytes.buffer as ArrayBuffer);
    const leftByA = current;
    world.rows.push({ id: "row-a", user_id: "member-a", endpoint: leftByA.endpoint });
    notification.permission = "granted";

    // Member B signs in on this device and never turned notifications on here.
    expect(await syncPushSubscription("member-b")).toBe("off");
    expect(leftByA.unsubscribe).toHaveBeenCalled();
    expect(current).toBeNull();
    expect(world.rows.some((r) => r.user_id === "member-b")).toBe(false);
  });

  it("keeps the subscription of a member who did enable it, even if their marker was cleared", async () => {
    await enablePush("member-1");
    localStorage.clear(); // the marker is a convenience, the server row is the source of truth
    const subscription = current;
    expect(await syncPushSubscription("member-1")).toBe("on");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("does not claim a state when the server cannot be asked", async () => {
    await enablePush("member-1");
    world.failSelect = true;
    expect(await syncPushSubscription("member-1")).toBe("unknown");
  });
});

describe("turning notifications off, and leaving", () => {
  it("removes the server row first and then the browser's subscription", async () => {
    await enablePush("member-1");
    const subscription = current;
    expect(await disablePush("member-1")).toBe(true);
    expect(world.rows).toHaveLength(0);
    expect(subscription.unsubscribe).toHaveBeenCalled();
    // A later sync must not bring it back by itself.
    expect(await syncPushSubscription("member-1")).toBe("off");
  });

  it("stays on, and says so, when the server could not remove it", async () => {
    await enablePush("member-1");
    world.failDelete = true;
    expect(await disablePush("member-1")).toBe(false);
    expect(current).not.toBeNull();
    expect(world.rows).toHaveLength(1);
  });

  it("at sign-out, stops this device receiving the member's notifications while the session can still do it", async () => {
    await enablePush("member-1");
    const subscription = current;
    await releasePushForSignOut();
    expect(world.rows).toHaveLength(0);
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(await syncPushSubscription("member-1")).toBe("off");
  });

  it("never blocks or fails a sign-out", async () => {
    world.registration.pushManager.getSubscription = vi.fn(async () => {
      throw new Error("worker gone");
    });
    await expect(releasePushForSignOut()).resolves.toBeUndefined();
    world.session = null;
    await expect(releasePushForSignOut()).resolves.toBeUndefined();
  });
});
