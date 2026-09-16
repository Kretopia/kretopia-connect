// Explicit Stripe test/live mode separation.
//
// Before this module every function read an ambiguous `STRIPE_SECRET_KEY`, so
// nothing prevented a sandbox run from hitting the live account (or a live
// deployment from silently running on a test key). Mode is now an explicit,
// server-side decision:
//
//   STRIPE_MODE = "test" | "live"   (defaults to "live" for backwards compat)
//
//   test  -> STRIPE_SECRET_KEY_TEST                 (must be a sk_test/rk_test key)
//   live  -> STRIPE_SECRET_KEY_LIVE || STRIPE_SECRET_KEY  (must NOT be a test key)
//
// Values are never logged, returned, or included in error messages — only the
// key *prefix class* is inspected to enforce the guard.

export type StripeMode = "test" | "live";

export function getStripeMode(): StripeMode {
  const raw = (Deno.env.get("STRIPE_MODE") ?? "live").trim().toLowerCase();
  if (raw !== "test" && raw !== "live") {
    throw new Error(`Invalid STRIPE_MODE (expected "test" or "live")`);
  }
  return raw;
}

function isTestKey(key: string): boolean {
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

function isLiveKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/**
 * Returns the Stripe secret key for the configured mode, refusing any
 * cross-mode key. Throws (fail-closed) rather than falling back.
 */
export function resolveStripeSecretKey(): string {
  const mode = getStripeMode();

  if (mode === "test") {
    const key = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? Deno.env.get("STRIPE_TEST_API_KEY");
    if (!key) {
      throw new Error("STRIPE_MODE=test but STRIPE_SECRET_KEY_TEST / STRIPE_TEST_API_KEY is not configured");
    }
    if (isLiveKey(key)) {
      throw new Error("Refusing to use a live Stripe key while STRIPE_MODE=test");
    }
    if (!isTestKey(key)) {
      throw new Error("STRIPE_SECRET_KEY_TEST does not look like a Stripe test key");
    }
    return key;
  }

  const key = Deno.env.get("STRIPE_SECRET_KEY_LIVE") ?? Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY_LIVE / STRIPE_SECRET_KEY is not configured");
  }
  if (isTestKey(key)) {
    throw new Error("Refusing to use a test Stripe key while STRIPE_MODE=live");
  }
  return key;
}

/**
 * Guards against a test event being delivered to a live-mode deployment and
 * vice versa (Stripe sets `livemode` on every event object).
 */
export function assertEventMatchesMode(livemode: boolean): void {
  const mode = getStripeMode();
  if (mode === "test" && livemode) throw new Error("Live event received in test mode");
  if (mode === "live" && !livemode) throw new Error("Test event received in live mode");
}

/** Non-secret diagnostics: names/presence only, never values. */
export function stripeModeDiagnostics() {
  return {
    mode: getStripeMode(),
    has_test_key: Boolean(Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? Deno.env.get("STRIPE_TEST_API_KEY")),
    has_live_key: Boolean(Deno.env.get("STRIPE_SECRET_KEY_LIVE") ?? Deno.env.get("STRIPE_SECRET_KEY")),
    has_wallet_webhook_secret: Boolean(Deno.env.get("STRIPE_WALLET_WEBHOOK_SECRET")),
    has_marketplace_webhook_secret: Boolean(Deno.env.get("STRIPE_MARKETPLACE_WEBHOOK_SECRET")),
    has_guest_webhook_secret: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")),
  };
}
