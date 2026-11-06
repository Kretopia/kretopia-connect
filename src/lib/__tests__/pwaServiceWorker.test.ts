/* eslint-disable @typescript-eslint/no-explicit-any -- the sandbox that stands in for a service worker is loosely typed on purpose */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// The installed app is a Workbox service worker generated at build time (vite.config.ts) plus one hand-written file of push
// handlers it imports. These tests pin what had gone wrong: the handler file shared the generated worker's name and was
// overwritten (no notification could ever show), a tap always opened a new window on the home page, the backend's answers were
// cached by URL alone, and one icon file served as both the normal and the maskable icon.
const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const config = read("vite.config.ts");
const withoutComments = config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the build wires the push handlers into the generated worker", () => {
  it("imports a handler file that cannot be overwritten by the generated /sw.js", () => {
    const imported = /importScripts:\s*\[\s*'([^']+)'\s*\]/.exec(withoutComments)?.[1];
    expect(imported).toBe("/push-handlers.js");
    expect(existsSync(resolve(root, "public", imported!.slice(1)))).toBe(true);
    // The worker is registered as /sw.js (src/lib/serviceWorker.ts), and the build writes it there: nothing in public/ may share the name.
    expect(existsSync(resolve(root, "public/sw.js"))).toBe(false);
    expect(read("src/lib/serviceWorker.ts")).toContain('register("/sw.js")');
  });

  it("does not store the backend's answers in a cache keyed by URL alone", () => {
    const runtimeCaching = /runtimeCaching:([\s\S]*?)manifest:/.exec(withoutComments)?.[1] ?? "";
    expect(runtimeCaching.length).toBeGreaterThan(100);
    expect(runtimeCaching).not.toMatch(/supabase/);
    // What is still cached is public and same-origin: navigations (network first) and static files.
    const caches = [...runtimeCaching.matchAll(/cacheName:\s*'([^']+)'/g)].map((m) => m[1]).sort();
    expect(caches).toEqual(["html-navigations", "static-assets"]);
    expect(runtimeCaching).toMatch(/urlPattern:\s*\(\{\s*url,\s*sameOrigin\s*\}\)\s*=>\s*sameOrigin/);
  });
});

// A PNG's header says its size and colour type without a decoder: IHDR starts at byte 16.
function png(path: string) {
  const bytes = readFileSync(resolve(root, "public", path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

describe("the manifest icons", () => {
  const manifest = /manifest:\s*\{([\s\S]*?)\n\s{8}\},?\n\s{6}\}\)/.exec(withoutComments)?.[1] ?? "";
  const icons = [...manifest.matchAll(/\{\s*src:\s*"([^"]+)",\s*sizes:\s*"(\d+)x(\d+)",\s*type:\s*"image\/png",\s*purpose:\s*"(any|maskable)"\s*\}/g)].map((m) => ({
    src: m[1].slice(1),
    size: Number(m[2]),
    purpose: m[4],
  }));

  it("declares 192 and 512 icons for both purposes, each a file of its declared size", () => {
    expect(icons.map((i) => `${i.purpose}:${i.size}`).sort()).toEqual(["any:192", "any:512", "maskable:192", "maskable:512"]);
    for (const icon of icons) {
      expect(existsSync(resolve(root, "public", icon.src)), icon.src).toBe(true);
      expect(png(icon.src), icon.src).toMatchObject({ width: icon.size, height: icon.size });
    }
  });

  it("never reuses one file for the normal and the maskable icon", () => {
    const files = icons.map((i) => i.src);
    expect(new Set(files).size).toBe(files.length);
  });

  it("makes the maskable icons full-bleed: opaque, so the system's mask has no transparent corners to show", () => {
    for (const icon of icons.filter((i) => i.purpose === "maskable")) {
      expect(png(icon.src).colorType, icon.src).toBe(2); // truecolor without an alpha channel
    }
  });

  it("states a stable app id, and the iOS and notification icons exist at their sizes", () => {
    expect(manifest).toMatch(/id:\s*"\/"/);
    expect(png("apple-touch-icon.png")).toMatchObject({ width: 180, height: 180 });
    expect(png("pwa-badge-96.png")).toMatchObject({ width: 96, height: 96, colorType: 6 }); // RGBA: only its alpha is drawn
  });
});

// ─── the handlers, run in a sandbox that stands in for a service worker ───────────────────────────────────────
type Listener = (event: Record<string, unknown>) => void;

function loadWorker(clientsOnPage: Array<Record<string, unknown>> = []) {
  const listeners: Record<string, Listener> = {};
  const shown: Array<{ title: string; options: Record<string, any> }> = [];
  const opened: string[] = [];
  const subscribed: unknown[] = [];
  const self = {
    location: { origin: "https://www.kretopia.com" },
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    skipWaiting: vi.fn(),
    registration: {
      showNotification: async (title: string, options: Record<string, any>) => {
        shown.push({ title, options });
      },
      pushManager: {
        subscribe: async (options: unknown) => {
          subscribed.push(options);
          return {};
        },
      },
    },
    clients: {
      matchAll: async () => clientsOnPage,
      openWindow: async (url: string) => {
        opened.push(url);
        return {};
      },
    },
  };
  vm.runInNewContext(read("public/push-handlers.js"), { self, URL, Promise, console });
  // A worker keeps the promise it was told to wait for; the tests await it the way the browser would.
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const pending: Array<Promise<unknown>> = [];
    listeners[type]({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  };
  return { self, listeners, shown, opened, subscribed, dispatch };
}

const payload = (value: unknown) => ({ data: { json: () => value, text: () => JSON.stringify(value) } });

describe("push handlers: showing a notification", () => {
  it("shows the title, the body, the brand icon and a badge, and keeps the deep link for the tap", async () => {
    const worker = loadWorker();
    await worker.dispatch("push", payload({ title: "Alex asked you to co-sign a credit", body: "Tap to answer", url: "/credit-verify?token=t1", tag: "cosign:1", type: "cosign_request" }));
    expect(worker.shown).toHaveLength(1);
    expect(worker.shown[0].title).toBe("Alex asked you to co-sign a credit");
    expect(worker.shown[0].options).toMatchObject({
      body: "Tap to answer",
      icon: "/pwa-192x192.png",
      badge: "/pwa-badge-96.png",
      tag: "cosign:1",
      renotify: true,
      data: { url: "/credit-verify?token=t1", type: "cosign_request" },
    });
  });

  it("does not ask to renotify without a tag (a browser rejects that combination)", async () => {
    const worker = loadWorker();
    await worker.dispatch("push", payload({ title: "Hi", body: "There" }));
    expect(worker.shown[0].options).not.toHaveProperty("renotify");
    expect(worker.shown[0].options).not.toHaveProperty("tag");
  });

  it("still shows something when the push carries no data or data that is not JSON", async () => {
    const empty = loadWorker();
    await empty.dispatch("push", {});
    expect(empty.shown[0]).toMatchObject({ title: "Kretopia", options: { body: "You have a new notification", data: { url: "/" } } });

    const plain = loadWorker();
    await plain.dispatch("push", {
      data: {
        json: () => {
          throw new SyntaxError("not json");
        },
        text: () => "You were mentioned",
      },
    });
    expect(plain.shown[0].options.body).toBe("You were mentioned");
  });

  it("never lets a payload point a tap at another site", async () => {
    for (const url of ["https://evil.test/phish", "//evil.test/x", "javascript:alert(1)"]) {
      const worker = loadWorker();
      await worker.dispatch("push", payload({ title: "Hi", body: "There", url }));
      expect(worker.shown[0].options.data.url, url).toMatch(/^\/[^/]?/);
      expect(worker.shown[0].options.data.url, url).not.toContain("evil.test");
    }
  });

  it("adds no install, activate or fetch handler: those belong to Workbox", () => {
    const worker = loadWorker();
    expect(Object.keys(worker.listeners).sort()).toEqual(["message", "notificationclick", "push", "pushsubscriptionchange"]);
  });
});

describe("push handlers: tapping a notification", () => {
  const tap = (url: unknown) => ({ notification: { close: vi.fn(), data: { url } } });

  it("takes an open window of the app to the page instead of opening another copy", async () => {
    const open = { url: "https://www.kretopia.com/desk", focus: vi.fn(async function (this: unknown) { return this; }), navigate: vi.fn(async () => ({})) };
    const worker = loadWorker([open]);
    const event = tap("/credit-verify?token=t1");
    await worker.dispatch("notificationclick", event);
    expect(event.notification.close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith("/credit-verify?token=t1");
    expect(worker.opened).toEqual([]);
  });

  it("opens the app on the page when none is open", async () => {
    const worker = loadWorker([]);
    await worker.dispatch("notificationclick", tap("/messages?user=alex-1"));
    expect(worker.opened).toEqual(["/messages?user=alex-1"]);
  });

  it("ignores a window of another origin, and falls back to a new window if navigating fails", async () => {
    const foreign = { url: "https://evil.test/", focus: vi.fn(), navigate: vi.fn() };
    const first = loadWorker([foreign]);
    await first.dispatch("notificationclick", tap("/messages"));
    expect(foreign.focus).not.toHaveBeenCalled();
    expect(first.opened).toEqual(["/messages"]);

    const stuck = { url: "https://www.kretopia.com/", focus: vi.fn(async () => stuck), navigate: vi.fn(async () => { throw new Error("blocked"); }) };
    const second = loadWorker([stuck]);
    await second.dispatch("notificationclick", tap("/messages"));
    expect(second.opened).toEqual(["/messages"]);
  });

  it("opens the home page for a missing or foreign link", async () => {
    for (const url of [undefined, "", "https://evil.test/x"]) {
      const worker = loadWorker([]);
      await worker.dispatch("notificationclick", tap(url));
      expect(worker.opened[0], String(url)).toBe("/");
    }
  });
});

describe("push handlers: the push service replaces a subscription", () => {
  it("subscribes again with the same server key and tells every open window to re-register it", async () => {
    const win = { url: "https://www.kretopia.com/", postMessage: vi.fn() };
    const worker = loadWorker([win]);
    const key = new Uint8Array([4, 1, 2, 3]);
    await worker.dispatch("pushsubscriptionchange", { oldSubscription: { options: { applicationServerKey: key } } });
    expect(worker.subscribed).toEqual([{ userVisibleOnly: true, applicationServerKey: key }]);
    expect(win.postMessage).toHaveBeenCalledWith({ type: "PUSH_SUBSCRIPTION_CHANGED" });
  });

  it("still tells the windows when it cannot resubscribe", async () => {
    const win = { url: "https://www.kretopia.com/", postMessage: vi.fn() };
    const worker = loadWorker([win]);
    await worker.dispatch("pushsubscriptionchange", {});
    expect(worker.subscribed).toEqual([]);
    expect(win.postMessage).toHaveBeenCalledWith({ type: "PUSH_SUBSCRIPTION_CHANGED" });
  });
});
