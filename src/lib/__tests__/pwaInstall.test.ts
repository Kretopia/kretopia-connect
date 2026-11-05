import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isSamsungInternet, openInChromeHref } from "../pwaInstall";

// Google Play Protect blocks the package Samsung Internet makes for an installed web app ("Unsafe app blocked: this app was built for an older
// version of Android"), so Kretopia is installed from Chrome and Samsung Internet is never offered the install.
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36";
const CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const originalUserAgent = navigator.userAgent;
afterEach(() => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
  document.head.innerHTML = "";
});

describe("Samsung Internet is never offered the install", () => {
  it("is recognised by its own user agent, and only by it", () => {
    expect(isSamsungInternet(SAMSUNG)).toBe(true);
    expect(isSamsungInternet(CHROME)).toBe(false);
    expect(isSamsungInternet(SAFARI)).toBe(false);
    expect(isSamsungInternet("")).toBe(false);
  });

  it("reads the browser's own user agent when none is given", () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: SAMSUNG });
    expect(isSamsungInternet()).toBe(true);
  });

  it("is sent to Chrome through an Android intent, with Chrome's Play Store page as the fallback", () => {
    const href = openInChromeHref("https://kretopia.com/install?ref=a#section");
    expect(href).toBe(
      "intent://kretopia.com/install?ref=a#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.android.chrome;end",
    );
    expect(href).not.toContain("#section");
  });
});

describe("index.html drops the web manifest for Samsung Internet, and only there", () => {
  // The real inline script of index.html, run as it is: the browser's own "Install app" is only offered when there is a manifest.
  const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
  const script = html.match(/<script>\s*\/\/ Samsung Internet packages[\s\S]*?<\/script>/)?.[0].replace(/<\/?script>/g, "") ?? "";

  const manifestAfter = (userAgent: string) => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
    new Function(script)();
    return document.querySelector('link[rel="manifest"]');
  };

  it("has the script, before the app starts", () => {
    expect(script).not.toBe("");
    expect(html.indexOf("SamsungBrowser")).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("removes the manifest link in Samsung Internet", () => {
    expect(manifestAfter(SAMSUNG)).toBeNull();
  });

  it("leaves it in Chrome and in Safari", () => {
    expect(manifestAfter(CHROME)).not.toBeNull();
    expect(manifestAfter(SAFARI)).not.toBeNull();
  });
});
