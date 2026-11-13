import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards what reaches the browser bundle (docs/security-compliance/security-review.md, finding "client secrets").
 *
 * Everything under src/ and public/, and whatever vite.config.ts defines, ships to every visitor. Only public client
 * configuration may appear there: the backend URL, its publishable (anon) key, the project id, the VAPID public key,
 * the site URL and the Sentry DSN. A server secret (service-role key, Stripe secret or webhook secret, email or AI
 * provider key, cron secret) must never be read or written in those files. This is a static scan: it fails in CI
 * before a secret can be published, and it never prints a matched value.
 */
const root = join(__dirname, "..", "..", "..", "..");

/** The import.meta.env names the client may read: all of them are public by design. */
const ALLOWED_CLIENT_ENV = new Set([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_VAPID_PUBLIC_KEY",
  "VITE_SITE_URL",
  "VITE_SENTRY_DSN",
  "VITE_GENERATE_STATIC_SOCIAL_PAGES",
  // Built-ins Vite always provides.
  "PROD",
  "DEV",
  "MODE",
  "BASE_URL",
  "SSR",
]);

/** Names of server-only secrets. None may be mentioned by client code, even to read an empty value. */
const SERVER_SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_MARKETPLACE_WEBHOOK_SECRET",
  "STRIPE_WALLET_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "LOVABLE_API_KEY",
  "CRON_SECRET",
  "DAILY_API_KEY",
  "DAILY_WEBHOOK_HMAC_SECRET",
  "TELEGRAM_API_KEY",
  "FIRECRAWL_API_KEY",
  "ELEVENLABS_API_KEY",
  "SENTRY_AUTH_TOKEN",
  "SUPABASE_ACCESS_TOKEN",
];

/** Shapes of real credentials. A match is reported by file and line only. */
const SECRET_SHAPES: { name: string; pattern: RegExp }[] = [
  { name: "Stripe secret or restricted key", pattern: /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9]{10,}/ },
  { name: "Resend API key", pattern: /\bre_[A-Za-z0-9]{20,}/ },
  { name: "private key block", pattern: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
];

const SCANNED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|txt|webmanifest)$/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Tests and their fixtures may name secrets to prove they are refused; they never ship.
      return entry === "__tests__" || entry === "__fixtures__" || entry === "node_modules" ? [] : walk(path);
    }
    return SCANNED_EXTENSIONS.test(entry) && !/\.(test|spec)\.[jt]sx?$/.test(entry) ? [path] : [];
  });

const clientFiles = [...walk(join(root, "src")), ...walk(join(root, "public")), join(root, "index.html"), join(root, "vite.config.ts")];
const rel = (path: string) => relative(root, path);

/** The payload of every JWT-shaped string in a source, decoded. The token itself is never returned. */
function jwtRoles(source: string): string[] {
  const roles: string[] = [];
  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
      roles.push(String(payload?.role ?? "unknown"));
    } catch {
      roles.push("undecodable");
    }
  }
  return roles;
}

describe("the client bundle carries public configuration only", () => {
  it("scans a meaningful set of files", () => {
    expect(clientFiles.length).toBeGreaterThan(500);
  });

  it("reads only allow-listed import.meta.env names, all of them public", () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
        if (!ALLOWED_CLIENT_ENV.has(match[1])) offenders.push(`${rel(file)}: import.meta.env.${match[1]}`);
      }
    }
    expect(offenders, "A client file reads an env value that is not on the public allow-list").toEqual([]);
  });

  it("never names a server-only secret", () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const name of SERVER_SECRET_NAMES) {
          if (new RegExp(`\\b${name}\\b`).test(line)) offenders.push(`${rel(file)}:${index + 1} mentions ${name}`);
        }
      });
    }
    expect(offenders, "Client code must not read or embed a server secret").toEqual([]);
  });

  it("contains nothing shaped like a real credential", () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const { name, pattern } of SECRET_SHAPES) if (pattern.test(line)) offenders.push(`${rel(file)}:${index + 1} looks like a ${name}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("embeds no JWT other than the publishable (anon) key: never a service-role token", () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      for (const role of jwtRoles(readFileSync(file, "utf8"))) if (role !== "anon") offenders.push(`${rel(file)}: JWT with role "${role}"`);
    }
    expect(offenders).toEqual([]);
  });

  it("defines only public values into the bundle from vite.config.ts", () => {
    const config = readFileSync(join(root, "vite.config.ts"), "utf8");
    const defined = [...config.matchAll(/"import\.meta\.env\.([A-Z0-9_]+)"\s*:/g)].map((match) => match[1]);
    expect(defined.length).toBeGreaterThan(0);
    for (const name of defined) expect(ALLOWED_CLIENT_ENV.has(name), name).toBe(true);
    // Vite exposes only VITE_-prefixed variables unless envPrefix widens it; widening it would leak server variables.
    expect(config).not.toMatch(/envPrefix\s*:/);
  });
});

describe("the guard itself can fail", () => {
  it("sees a secret shape, a service-role JWT and a non-public env name", () => {
    const fakeStripe = ["sk", "live", "A1b2C3d4E5f6G7h8I9j0"].join("_");
    expect(SECRET_SHAPES.some(({ pattern }) => pattern.test(`const key = "${fakeStripe}"`))).toBe(true);

    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const serviceJwt = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role: "service_role", iss: "test" })}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`;
    expect(jwtRoles(`const t = "${serviceJwt}"`)).toEqual(["service_role"]);

    expect(ALLOWED_CLIENT_ENV.has("VITE_STRIPE_SECRET_KEY")).toBe(false);
  });
});
