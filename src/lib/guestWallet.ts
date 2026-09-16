/**
 * Guest Wallet client helper.
 * Stores a session token in localStorage and calls the public edge functions
 * with x-guest-token header. No Supabase auth required.
 */

const TOKEN_KEY = "thrivein.guestWalletToken";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type GuestWallet = {
  id: string;
  email: string;
  balance_cents: number;
  currency: string;
};

export type GuestTopup = {
  id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  created_at: string;
};

export function getGuestToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setGuestToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearGuestToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function callFn<T>(name: string, init: RequestInit & { withToken?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.withToken) {
    const token = getGuestToken();
    if (!token) throw new Error("No guest session");
    headers["x-guest-token"] = token;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json as T;
}

/** Step 1: emails a 6-digit verification code to prove email ownership. */
export async function requestGuestCode(email: string) {
  return callFn<{ requiresCode: true }>("guest-wallet-session", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Step 2: exchanges the emailed code for a guest wallet session. */
export async function startGuestSession(email: string, code: string) {
  const data = await callFn<{
    token: string;
    walletId: string;
    balanceCents: number;
    currency: string;
  }>("guest-wallet-session", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  setGuestToken(data.token);
  return data;
}

export async function fetchGuestWallet() {
  return callFn<{ wallet: GuestWallet; topups: GuestTopup[] }>("guest-wallet-me", {
    method: "POST",
    withToken: true,
  });
}

export async function createGuestTopup(amount: number) {
  return callFn<{ url: string; topupId: string }>("guest-wallet-topup", {
    method: "POST",
    withToken: true,
    body: JSON.stringify({ amount, currency: "USD" }),
  });
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
