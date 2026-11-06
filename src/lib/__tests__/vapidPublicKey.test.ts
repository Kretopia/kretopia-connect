import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The published build was compiled with an empty VAPID public key, so Settings said "Notifications are not available yet" and no device could
// subscribe. The key is public by construction (the browser needs it, and it ships in every bundle), so the build carries it as a default,
// the way it carries the other public backend values; an environment value still wins.
const root = resolve(__dirname, "../../..");
const config = readFileSync(resolve(root, "vite.config.ts"), "utf8");
const testConfig = readFileSync(resolve(root, "vitest.config.ts"), "utf8");
const key = /const PUBLIC_VAPID_PUBLIC_KEY = "([A-Za-z0-9_-]+)";/.exec(config)?.[1] ?? "";

describe("the build carries the VAPID public key", () => {
  it("has a default", () => {
    expect(key).not.toBe("");
  });

  it("is a real uncompressed P-256 public key: 65 bytes, a point on the curve, not a private scalar or a typo", async () => {
    const raw = Buffer.from(key, "base64url");
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    // WebCrypto refuses a point that is not on the curve.
    await expect(webcrypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: "P-256" }, true, [])).resolves.toBeDefined();
  });

  it("is wired in like the other public values: an environment value wins and the default fills in", () => {
    expect(config).toMatch(/const vapidPublicKey = env\.VITE_VAPID_PUBLIC_KEY \|\| PUBLIC_VAPID_PUBLIC_KEY;/);
    expect(config).toMatch(/"import\.meta\.env\.VITE_VAPID_PUBLIC_KEY": JSON\.stringify\(vapidPublicKey\),/);
  });

  it("is not defined for the tests: they stub the variable one case at a time, and a static value would defeat that", () => {
    expect(testConfig).not.toContain("VITE_VAPID_PUBLIC_KEY");
  });

  it("holds no private material: no code in the config names or assigns a VAPID private key", () => {
    // Comments may talk about it (this one's do); code must not carry it.
    const code = config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/vapid[_a-z]*private|private[_a-z]*key/i);
  });
});
