import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the controls every Stripe webhook already has (docs/security-compliance/security-review.md, "webhooks"), so a
 * later edit cannot quietly drop one. Behaviour is covered elsewhere (stripeWebhookSignature, webhookLedger,
 * marketplaceWebhookScenarios, guestWallet); this checks that each handler still wires them, in the right order:
 *
 *   1. the signature is checked against the RAW body (req.text()), never a re-serialised JSON object;
 *   2. through Stripe's verifier, which enforces the timestamp tolerance (replay window);
 *   3. a test-mode event is refused by a live deployment and the reverse (assertEventMatchesMode);
 *   4. the event id is claimed in the stripe_webhook_events ledger before any processing, so a redelivery is not
 *      processed twice, and a duplicate is answered 2xx without side effects.
 */
const root = join(__dirname, "..", "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const WEBHOOKS = ["stripe-marketplace-webhook", "stripe-wallet-webhook", "guest-wallet-webhook"] as const;

const position = (source: string, pattern: RegExp) => {
  const match = source.match(pattern);
  return match?.index ?? -1;
};

describe.each(WEBHOOKS)("%s keeps its webhook controls", (name) => {
  const source = read(`supabase/functions/${name}/index.ts`);
  const rawBody = position(source, /await req\.text\(\)/);
  const verify = position(source, /stripe\.webhooks\.constructEventAsync\(/);
  const mode = position(source, /assertEventMatchesMode\(\s*event\.livemode\s*\)/);
  const ledger = position(source, /claimWebhookEvent\(|from\("stripe_webhook_events"\)\.insert\(/);
  const firstType = position(source, /event\.type\s*(===|!==)|switch\s*\(\s*event\.type\s*\)/);

  it("reads the raw body and verifies the signature on it", () => {
    expect(rawBody, "req.text()").toBeGreaterThan(-1);
    expect(verify, "constructEventAsync").toBeGreaterThan(rawBody);
    expect(source).not.toMatch(/await req\.json\(\)/);
  });

  it("refuses an event from the other Stripe mode", () => {
    expect(mode).toBeGreaterThan(verify);
  });

  it("answers a bad signature with a 4xx and processes nothing", () => {
    const catchBlock = source.slice(verify, verify + 900);
    expect(catchBlock).toMatch(/status:\s*400/);
  });

  it("claims the event id in the ledger before acting on the event", () => {
    expect(ledger, "ledger claim").toBeGreaterThan(mode);
    // A handler may branch on the type to ignore events it does not handle, but nothing that acts on an event may run
    // before the claim. guest-wallet-webhook returns early for ignored types before claiming, which acts on nothing.
    if (name !== "guest-wallet-webhook") expect(firstType).toBeGreaterThan(ledger);
  });

  it("does not log the webhook secret's value or the raw signature header", () => {
    // Naming a missing secret in a log ("missing STRIPE_..._SECRET") is fine; passing the value to a log is not.
    const logCalls = source.split("\n").filter((line) => /\b(log|logStep|console\.[a-z]+)\(/.test(line));
    const withoutStrings = logCalls.map((line) => line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""'));
    for (const line of withoutStrings) expect(line).not.toMatch(/\b(secret|webhookSecret|sig|signature)\b/);
    expect(source).not.toMatch(/JSON\.stringify\([^)]*stripe-signature/i);
  });
});

describe("the shared helpers the webhooks rely on", () => {
  it("rejects cross-mode events in both directions", () => {
    const env = read("supabase/functions/_shared/stripeEnv.ts");
    expect(env).toMatch(/mode === "test" && livemode\) throw/);
    expect(env).toMatch(/mode === "live" && !livemode\) throw/);
  });

  it("treats a unique-key conflict on the ledger as a duplicate, a retryable failure as 'unavailable', and gives the row back when processing fails", () => {
    const ledger = read("supabase/functions/_shared/webhookLedger.ts");
    expect(ledger).toMatch(/code === "23505"\) return "duplicate"/);
    expect(ledger).toMatch(/return "unavailable"/);
    expect(ledger).toMatch(/export async function releaseWebhookEvent/);
  });
});
