/**
 * Client for the username-auth edge function.
 *
 * Hosted on the Lovable Cloud backend (same pattern as publicWebSearchEndpoint):
 * only the publishable, browser-safe key is used here. The function resolves
 * @username → session server-side; the email is never sent to the browser.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeUsername, validateUsername } from "@/lib/username";

const AUTH_BACKEND_URL = "https://czpucbhnmcudggydwxlg.supabase.co";
const AUTH_BACKEND_PUBLISHABLE_KEY = "sb_publishable_ssXNn-GlHaO9CYIjNj_URg_jQFG1Vep";

export const GENERIC_USERNAME_SIGNIN_ERROR = "Invalid username or password";

export type UsernameAvailability = "available" | "taken" | "invalid" | "reserved" | "error";

async function postUsernameAuth(payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${AUTH_BACKEND_URL}/functions/v1/username-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: AUTH_BACKEND_PUBLISHABLE_KEY },
    body: JSON.stringify(payload),
  });
}

/**
 * Real availability check via the edge function (server-side, rate limited).
 * Returns "error" when the service is unreachable so the UI can show an
 * honest state instead of a fake "available".
 */
export async function checkUsernameAvailability(raw: string): Promise<UsernameAvailability> {
  const username = normalizeUsername(raw);
  const v = validateUsername(username);
  if (v === "required" || v === "invalid") return "invalid";
  if (v === "reserved") return "reserved";
  try {
    const res = await postUsernameAuth({ action: "check-username", username });
    if (!res.ok) return "error";
    const data = await res.json().catch(() => null);
    if (data?.available === true) return "available";
    if (data?.reason === "taken") return "taken";
    if (data?.reason === "reserved") return "reserved";
    if (data?.reason === "invalid") return "invalid";
    return "error";
  } catch {
    return "error";
  }
}

// Single shape (not a discriminated union): this project's tsconfig runs with
// strict:false, where union narrowing on `ok` does not apply.
export type UsernameSignInResult = {
  ok: boolean;
  error?: "invalid" | "rate_limited" | "network" | "unavailable";
};

/**
 * Sign in with @username + password. The edge function resolves the email
 * server-side and returns session tokens only; we then attach the session to
 * the app client. Every credential failure is the same generic error.
 */
export async function signInWithUsername(rawUsername: string, password: string): Promise<UsernameSignInResult> {
  const username = normalizeUsername(rawUsername);
  if (validateUsername(username) !== "ok" || !password) return { ok: false, error: "invalid" };
  try {
    const res = await postUsernameAuth({ action: "sign-in", username, password });
    if (res.status === 429) return { ok: false, error: "rate_limited" };
    if (res.status === 503) return { ok: false, error: "unavailable" };
    if (!res.ok) return { ok: false, error: "invalid" };
    const data = await res.json().catch(() => null);
    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) return { ok: false, error: "invalid" };
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return { ok: false, error: "invalid" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
