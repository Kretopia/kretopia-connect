import { supabase } from "@/integrations/supabase/client";
import { ensureAppServiceWorkerRegistered, getAppServiceWorkerRegistration, isStandalonePWA } from "@/lib/serviceWorker";

// Web Push from the member's side: can this device receive notifications, turn them on, turn them off, and stay correctly
// bound to the account that asked for them. A device is "on" only when the browser holds a subscription AND the server has a
// row for this member and this endpoint: a subscription the server never stored receives nothing, so it is not shown as on.

export type PushAvailability =
  | "ready" // this device can turn notifications on
  | "unsupported" // no service worker, Push API or Notification API in this browser
  | "install" // supported, but only the installed app keeps a worker: browser tabs clear it at start (main.tsx)
  | "ios-install" // iPhone and iPad: Web Push exists only for an app added to the Home Screen
  | "not-configured" // this build has no VAPID public key, so a subscription cannot be made
  | "blocked"; // the member denied the permission in the browser

export type PushFailure = "unavailable" | "not-configured" | "blocked" | "dismissed" | "failed";

export const getVapidPublicKey = (): string => String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "").trim();

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function getPushAvailability(): PushAvailability {
  const standalone = isStandalonePWA();
  if (isIOS() && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!standalone) return "install";
  if (!getVapidPublicKey()) return "not-configured";
  if (Notification.permission === "denied") return "blocked";
  return "ready";
}

/** What to tell the member when notifications cannot be turned on here, and why. */
export function describePushAvailability(availability: Exclude<PushAvailability, "ready">): { title: string; description: string } {
  switch (availability) {
    case "ios-install":
      return {
        title: "Add Kretopia to your Home Screen first",
        description: "On iPhone and iPad, notifications work only in the installed app. Add Kretopia to your Home Screen, open it from there, then turn notifications on.",
      };
    case "install":
      return {
        title: "Install the app to get notifications",
        description: "Notifications are delivered to the installed Kretopia app. Install it, open it from your home screen or app list, then turn notifications on.",
      };
    case "not-configured":
      return {
        title: "Notifications are not available yet",
        description: "Push notifications are not switched on for Kretopia yet. Your in-app notifications keep working.",
      };
    case "blocked":
      return {
        title: "Notifications are blocked",
        description: "You blocked notifications for Kretopia. Allow them in your browser or phone settings for this app, then come back and turn them on.",
      };
    default:
      return {
        title: "Notifications are not supported here",
        description: "This browser cannot receive push notifications. Try Chrome, Edge or Safari, or install the app.",
      };
  }
}

export function describePushFailure(reason: PushFailure): { title: string; description: string } {
  switch (reason) {
    case "blocked":
      return describePushAvailability("blocked");
    case "not-configured":
      return describePushAvailability("not-configured");
    case "unavailable":
      return describePushAvailability("unsupported");
    case "dismissed":
      return { title: "Notifications are still off", description: "You closed the permission prompt without choosing. Turn notifications on again when you are ready." };
    default:
      return { title: "We could not turn notifications on", description: "This device could not be registered. Check your connection and try again." };
  }
}

// ─── Which member turned notifications on, on this device ─────────────────────────────────────────
// A subscription belongs to a browser, not to an account. This marker says this member enabled notifications on this device, so
// a subscription the server lost (the push service rotated or expired it) may be registered again for them, and one left
// behind by someone else on a shared device is never inherited silently.
const markerKey = (userId: string) => `kretopia.push.enabled.${userId}`;
const hasMarker = (userId: string) => {
  try {
    return localStorage.getItem(markerKey(userId)) === "1";
  } catch {
    return false;
  }
};
const setMarker = (userId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(markerKey(userId), "1");
    else localStorage.removeItem(markerKey(userId));
  } catch {
    // storage unavailable (private window): the marker is a convenience, not the source of truth
  }
};

// ─── Encoding ─────────────────────────────────────────────────────────────────────────────────────────

function toBase64(buffer: ArrayBuffer | null): string | null {
  if (!buffer) return null;
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => (binary += String.fromCharCode(byte)));
  return window.btoa(binary);
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const sameBytes = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
};

// ─── The browser's subscription and the server's row ────────────────────────────────────────────────

/** The subscription this browser holds, if any. Reads only: it never registers a worker. */
export async function readBrowserSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await getAppServiceWorkerRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** true: the server has this member's row for the endpoint; false: it has not; null: it could not be asked. */
async function hasServerRow(userId: string, endpoint: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("push_subscriptions").select("id").eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (error) return null;
  return !!data;
}

/** Stores the subscription for the member and reads it back: only a row the server returns counts as stored. */
async function storeSubscription(userId: string, subscription: PushSubscription): Promise<boolean> {
  const p256dh = toBase64(subscription.getKey("p256dh"));
  const auth = toBase64(subscription.getKey("auth"));
  if (!p256dh || !auth) return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: subscription.endpoint, p256dh, auth }, { onConflict: "user_id,endpoint" })
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

/** Where this device stands for this member. "unknown" means the server could not be asked: the caller keeps what it showed. */
export async function syncPushSubscription(userId: string): Promise<"on" | "off" | "unknown"> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return "off";
  const subscription = await readBrowserSubscription();
  if (!subscription) return "off";

  const stored = await hasServerRow(userId, subscription.endpoint);
  if (stored === true) return "on";
  if (stored === null) return "unknown";
  // The browser holds a subscription the server has no row for under this member.
  if (hasMarker(userId)) {
    // They turned notifications on here, so it is theirs: the push service rotated it, or the server dropped it. Register it again.
    return (await storeSubscription(userId, subscription)) ? "on" : "off";
  }
  // Not theirs: what a previous account left behind on a shared device (a session that expired without a sign-out), or nobody's.
  // Kept, it would keep delivering that account's notifications to whoever is signed in now. This member opts in themselves.
  await subscription.unsubscribe().catch(() => false);
  return "off";
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error)),
    );
  });

/**
 * Turns notifications on for this member on this device. Call it straight from the tap: the permission prompt has to be the first
 * thing that happens, because browsers (iOS above all) only show it while the tap is still the active gesture.
 */
export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: PushFailure }> {
  const availability = getPushAvailability();
  if (availability === "not-configured") return { ok: false, reason: "not-configured" };
  if (availability === "blocked") return { ok: false, reason: "blocked" };
  if (availability !== "ready") return { ok: false, reason: "unavailable" };

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission === "denied") return { ok: false, reason: "blocked" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  try {
    await ensureAppServiceWorkerRegistered();
    const registration = await withTimeout(navigator.serviceWorker.ready, 10_000);
    const key = urlBase64ToBytes(getVapidPublicKey());

    let existing = await registration.pushManager.getSubscription();
    // Start from a new endpoint when the browser's subscription is not this member's: it is the leftover of another account on a
    // shared device, or one that expired, or one made with another server key. A fresh endpoint cannot be reached through anyone
    // else's account, and a key mismatch can never be delivered to.
    if (existing && ((await hasServerRow(userId, existing.endpoint)) !== true || !sameBytes(existing.options.applicationServerKey, key))) {
      await existing.unsubscribe();
      existing = null;
    }
    const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));

    if (!(await storeSubscription(userId, subscription))) {
      // Not stored means not on: leave nothing half-registered behind.
      if (!existing) await subscription.unsubscribe().catch(() => false);
      return { ok: false, reason: "failed" };
    }
    setMarker(userId, true);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Turns notifications off for this member on this device. false: the server still has the subscription, so it is still on. */
export async function disablePush(userId: string): Promise<boolean> {
  try {
    const subscription = await readBrowserSubscription();
    if (subscription) {
      const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint);
      if (error) return false;
      await subscription.unsubscribe().catch(() => false);
    }
    setMarker(userId, false);
    return true;
  } catch {
    return false;
  }
}

/**
 * Before a member signs out: stop this device receiving their notifications. The row is removed while the session can still
 * remove it (afterwards nothing can), and the browser subscription is dropped so the next person on this device starts clean.
 * Bounded and never throwing: signing out must not wait on, or fail because of, push.
 */
export async function releasePushForSignOut(): Promise<void> {
  const release = async () => {
    const subscription = await readBrowserSubscription();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (subscription && userId) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint);
    }
    await subscription?.unsubscribe().catch(() => false);
    if (userId) setMarker(userId, false);
  };
  try {
    await withTimeout(release(), 3_000);
  } catch {
    // best effort
  }
}
