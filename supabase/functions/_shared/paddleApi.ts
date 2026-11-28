// The two Paddle API calls the app needs, over an injectable fetch so tests never touch the network. The API key is passed in by the
// caller (from the environment) and is only ever sent as the Authorization header: never logged, never in an error message.

import type { PaddleEnvironment } from "./paddleEnv.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider payloads are untyped JSON
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

const BASE: Record<PaddleEnvironment, string> = { sandbox: "https://sandbox-api.paddle.com", live: "https://api.paddle.com" };

async function call(fetchFn: FetchLike, env: PaddleEnvironment, apiKey: string, method: string, path: string, body?: unknown) {
  const res = await fetchFn(`${BASE[env]}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Paddle API ${method} ${path.split("?")[0].replace(/\/(ctm|sub)_[0-9a-z]+/gi, "/:id")} failed (${res.status}${json?.error?.code ? `, ${json.error.code}` : ""})`);
  return json?.data;
}

/**
 * A draft transaction for one price, created by the server so the price and the attribution (custom_data) are the server's, never
 * the browser's. The browser only opens it: Paddle.Checkout.open({ transactionId }).
 */
export async function createTransaction(
  fetchFn: FetchLike, env: PaddleEnvironment, apiKey: string,
  input: { priceId: string; customData: Record<string, string> },
): Promise<{ id: string }> {
  const data = await call(fetchFn, env, apiKey, "POST", "/transactions", {
    items: [{ price_id: input.priceId, quantity: 1 }],
    collection_mode: "automatic",
    custom_data: input.customData,
  });
  if (typeof data?.id !== "string") throw new Error("Paddle API returned no transaction id");
  return { id: data.id };
}

/** A customer-portal link (manage payment method, invoices, cancel) for a customer we already know from a verified event. */
export async function createPortalSession(
  fetchFn: FetchLike, env: PaddleEnvironment, apiKey: string,
  input: { customerId: string; subscriptionId?: string | null },
): Promise<{ url: string }> {
  const data = await call(fetchFn, env, apiKey, "POST", `/customers/${encodeURIComponent(input.customerId)}/portal-sessions`,
    input.subscriptionId ? { subscription_ids: [input.subscriptionId] } : {});
  const url = data?.urls?.general?.overview;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("Paddle API returned no portal link");
  return { url };
}
