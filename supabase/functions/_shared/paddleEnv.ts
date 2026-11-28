// Paddle configuration: one explicit environment (sandbox | live) and a consistency check, so a sandbox key can never meet a live
// price, client token or webhook secret. Pure: callers pass the environment in (Deno.env in the edge functions, a plain object in
// tests). Values are never returned in errors or logs — only names and key classes.
//
//   BILLING_PROVIDER          stripe (default) | paddle        which provider checkout / portal / sync use
//   PADDLE_ALLOWED_USER_IDS   optional, comma-separated user ids: while set, ONLY these members get Paddle checkout (everyone else stays on
//                             Stripe). It is how a live test runs before the plan is opened to customers. Empty or unset = everyone.
//   PADDLE_ENV                sandbox | live                    required when BILLING_PROVIDER=paddle
//   PADDLE_API_KEY            pdl_sdbx_apikey_… | pdl_live_apikey_…        server only
//   PADDLE_WEBHOOK_SECRET     endpoint secret key (pdl_ntfset_…)           server only
//   PADDLE_CLIENT_TOKEN       test_… | live_…                              public by design (Paddle.js)
//   PADDLE_PRICE_<TIER>_<INTERVAL>   pri_… for PRO|CREATOR_PRO|BRAND_PRO|BRAND_ENTERPRISE × MONTHLY|YEARLY

export type PaddleEnvironment = "sandbox" | "live";
export type BillingProvider = "stripe" | "paddle";
export type PaidTier = "pro" | "creator_pro" | "brand_pro" | "brand_enterprise";
export type BillingInterval = "monthly" | "yearly";

export const PAID_TIERS: readonly PaidTier[] = ["pro", "creator_pro", "brand_pro", "brand_enterprise"];
export const INTERVALS: readonly BillingInterval[] = ["monthly", "yearly"];

export type EnvSource = Record<string, string | undefined>;

export const priceEnvName = (tier: PaidTier, interval: BillingInterval) => `PADDLE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;

export function billingProvider(env: EnvSource): BillingProvider {
  const raw = (env.BILLING_PROVIDER ?? "stripe").trim().toLowerCase();
  if (raw !== "stripe" && raw !== "paddle") throw new Error(`Invalid BILLING_PROVIDER (expected "stripe" or "paddle")`);
  return raw;
}

/**
 * Which provider starts a checkout for this member. BILLING_PROVIDER decides for everyone, unless PADDLE_ALLOWED_USER_IDS narrows
 * Paddle to a list of testers. Existing Paddle members keep Paddle through their stored provider, not through this function.
 */
export function providerForUser(env: EnvSource, userId: string): BillingProvider {
  if (billingProvider(env) !== "paddle") return "stripe";
  const allowed = (env.PADDLE_ALLOWED_USER_IDS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(userId.toLowerCase()) ? "paddle" : "stripe";
}

const keyClass = (key: string): PaddleEnvironment | null =>
  key.startsWith("pdl_sdbx_apikey_") ? "sandbox" : key.startsWith("pdl_live_apikey_") ? "live" : null;
const tokenClass = (token: string): PaddleEnvironment | null =>
  token.startsWith("test_") ? "sandbox" : token.startsWith("live_") ? "live" : null;

export interface PaddleEnvReport {
  ok: boolean;
  environment: PaddleEnvironment | null;
  /** Names and reasons only, never values. */
  errors: string[];
}

/** Every inconsistency at once, so a misconfigured deployment is fixed in one pass. */
export function checkPaddleEnv(env: EnvSource, need: { apiKey?: boolean; webhookSecret?: boolean; clientToken?: boolean; prices?: boolean } = {}): PaddleEnvReport {
  const errors: string[] = [];
  const raw = (env.PADDLE_ENV ?? "").trim().toLowerCase();
  const environment: PaddleEnvironment | null = raw === "sandbox" || raw === "live" ? raw : null;
  if (!environment) errors.push(`PADDLE_ENV must be "sandbox" or "live"`);

  if (need.apiKey) {
    const key = env.PADDLE_API_KEY;
    if (!key) errors.push("PADDLE_API_KEY is not set");
    else if (!keyClass(key)) errors.push("PADDLE_API_KEY does not look like a Paddle API key");
    else if (environment && keyClass(key) !== environment) errors.push(`PADDLE_API_KEY is a ${keyClass(key)} key but PADDLE_ENV=${environment}`);
  }
  if (need.webhookSecret && !env.PADDLE_WEBHOOK_SECRET) errors.push("PADDLE_WEBHOOK_SECRET is not set");
  if (need.clientToken) {
    const token = env.PADDLE_CLIENT_TOKEN;
    if (!token) errors.push("PADDLE_CLIENT_TOKEN is not set");
    else if (!tokenClass(token)) errors.push("PADDLE_CLIENT_TOKEN does not look like a Paddle client-side token");
    else if (environment && tokenClass(token) !== environment) errors.push(`PADDLE_CLIENT_TOKEN is a ${tokenClass(token)} token but PADDLE_ENV=${environment}`);
  }
  if (need.prices) {
    for (const tier of PAID_TIERS) for (const interval of INTERVALS) {
      const name = priceEnvName(tier, interval);
      const id = env[name];
      if (!id) errors.push(`${name} is not set`);
      else if (!/^pri_[0-9a-z]{20,40}$/i.test(id)) errors.push(`${name} is not a Paddle price id`);
    }
  }
  return { ok: errors.length === 0, environment, errors };
}

/** Throws the full list of problems, naming variables but never printing values. */
export function assertPaddleEnv(env: EnvSource, need?: Parameters<typeof checkPaddleEnv>[1]): PaddleEnvironment {
  const report = checkPaddleEnv(env, need);
  if (!report.ok || !report.environment) throw new Error(`Paddle is misconfigured: ${report.errors.join("; ")}`);
  return report.environment;
}

export interface PaddlePriceMap {
  /** price id → tier and interval; the only way a price id becomes an entitlement. */
  byPriceId: Map<string, { tier: PaidTier; interval: BillingInterval }>;
  priceFor(tier: PaidTier, interval: BillingInterval): string | null;
}

export function paddlePrices(env: EnvSource): PaddlePriceMap {
  const byPriceId = new Map<string, { tier: PaidTier; interval: BillingInterval }>();
  const byTier = new Map<string, string>();
  for (const tier of PAID_TIERS) for (const interval of INTERVALS) {
    const id = env[priceEnvName(tier, interval)];
    if (!id) continue;
    byPriceId.set(id, { tier, interval });
    byTier.set(`${tier}:${interval}`, id);
  }
  return { byPriceId, priceFor: (tier, interval) => byTier.get(`${tier}:${interval}`) ?? null };
}

export const isPaidTier = (value: string): value is PaidTier => (PAID_TIERS as readonly string[]).includes(value);
