import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * username-auth — @username sign-in and availability checks.
 *
 * Hosted on the Lovable Cloud backend because the legacy production backend
 * cannot receive deployments. It talks to the legacy backend through the
 * LEGACY_* secrets (server-only, never exposed to the browser):
 *   LEGACY_SUPABASE_URL, LEGACY_SUPABASE_ANON_KEY, LEGACY_SUPABASE_SERVICE_ROLE_KEY
 *
 * Security rules (product brief):
 * - Username → email resolution happens ONLY here, server-side.
 * - The response NEVER contains the email — only session tokens on success.
 * - Every sign-in failure returns the same generic error.
 * - Attempts are rate limited per IP and per username (atomic quota RPC).
 */

const GENERIC_ERROR = "Invalid username or password";
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const RESERVED = new Set([
  "auth", "admin", "api", "settings", "profile", "passport", "desk",
  "scout", "stages", "match", "circle", "site", "www", "support",
  "login", "signup", "website-builder", "notifications", "messages",
  "discover", "wallet", "subscription", "spotlight", "magazine", "podcast",
  "fund", "ambassadors", "claim", "verify", "share", "terms", "privacy",
  "community", "kretopia", "thrive", "thrivein", "app", "root", "system",
]);

const normalize = (raw: unknown): string =>
  (typeof raw === "string" ? raw : "").trim().toLowerCase().replace(/^@+/, "");

const validate = (u: string): "ok" | "required" | "invalid" | "reserved" => {
  if (!u) return "required";
  if (!USERNAME_RE.test(u) || u.startsWith("_") || u.endsWith("_")) return "invalid";
  if (RESERVED.has(u)) return "reserved";
  return "ok";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Exact, case-insensitive username lookup on the legacy profiles table.
 *  Returns "error" on query failure so callers can fail CLOSED — a failed
 *  lookup must never report a handle as available. */
async function findProfileByUsername(
  legacyUrl: string,
  serviceKey: string,
  username: string,
): Promise<{ user_id: string; username: string } | null | "error"> {
  // "_" and "%" are LIKE wildcards — escape them before ilike.
  // The public safe view is the canonical username surface (it is what the
  // app's HandleResolver uses); the raw profiles table is RLS-restricted.
  const pattern = username.replace(/[%_\\]/g, (c) => `\\${c}`);
  const res = await fetch(
    `${legacyUrl}/rest/v1/public_profiles_safe?select=user_id,username&username=ilike.${encodeURIComponent(pattern)}&limit=5`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) {
    console.error("[username-auth] legacy profiles lookup failed", res.status);
    return "error";
  }
  const rows = (await res.json().catch(() => [])) as { user_id: string; username: string }[];
  return rows.find((r) => (r.username || "").toLowerCase() === username) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const LEGACY_URL = Deno.env.get("LEGACY_SUPABASE_URL");
  const LEGACY_ANON = Deno.env.get("LEGACY_SUPABASE_ANON_KEY");
  const LEGACY_SERVICE = Deno.env.get("LEGACY_SUPABASE_SERVICE_ROLE_KEY");
  const CLOUD_URL = Deno.env.get("SUPABASE_URL");
  const CLOUD_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!LEGACY_URL || !LEGACY_ANON || !CLOUD_URL || !CLOUD_SERVICE) {
    return json({ error: "Username sign-in is not available yet" }, 503);
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  const username = normalize(body?.username);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const cloud = createClient(CLOUD_URL, CLOUD_SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const allowed = async (bucket: string, minuteCap: number, dayCap: number): Promise<boolean> => {
    const { data, error } = await cloud.rpc("consume_username_auth_attempt", {
      _bucket: bucket,
      _minute_cap: minuteCap,
      _day_cap: dayCap,
    });
    if (error) {
      console.error("[username-auth] rate limiter error", error.message);
      return false; // fail closed
    }
    return data === true;
  };

  // Records "legacy account -> email" after verifying the caller's own legacy
  // session. Needs only the public key: the legacy auth server validates the
  // token. The username itself is always read live from public profiles.
  if (action === "link") {
    const token = (req.headers.get("x-legacy-access-token") || "").trim();
    if (!token) return json({ error: "Missing session" }, 401);
    if (!(await allowed(`link:${ip}`, 20, 200))) return json({ error: "Too many attempts" }, 429);
    const res = await fetch(`${LEGACY_URL}/auth/v1/user`, {
      headers: { apikey: LEGACY_ANON, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return json({ error: "Invalid session" }, 401);
    const u = (await res.json().catch(() => null)) as { id?: string; email?: string } | null;
    if (!u?.id || !u?.email) return json({ error: "Invalid session" }, 401);
    const { error } = await cloud.from("username_login_links").upsert({
      legacy_user_id: u.id,
      email: u.email.toLowerCase(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[username-auth] link upsert failed", error.message);
      return json({ error: "Link failed" }, 500);
    }
    return json({ linked: true });
  }

  if (action === "check-username") {
    const v = validate(username);
    if (v === "required" || v === "invalid") return json({ available: false, reason: "invalid" });
    if (v === "reserved") return json({ available: false, reason: "reserved" });
    if (!(await allowed(`check:${ip}`, 30, 300))) return json({ error: "Too many attempts" }, 429);
    const found = await findProfileByUsername(LEGACY_URL, LEGACY_ANON, username);
    if (found === "error") return json({ error: "Username check unavailable" }, 503);
    return json({ available: !found, reason: found ? "taken" : null });
  }

  if (action === "sign-in") {
    const password = typeof body?.password === "string" ? body.password : "";
    if (validate(username) !== "ok" || !password) return json({ error: GENERIC_ERROR }, 401);
    if (
      !(await allowed(`signin:ip:${ip}`, 10, 100)) ||
      !(await allowed(`signin:u:${username}`, 5, 30))
    ) {
      return json({ error: "Too many attempts. Try again later." }, 429);
    }

    const profile = await findProfileByUsername(LEGACY_URL, LEGACY_ANON, username);
    if (profile === "error" || !profile?.user_id) return json({ error: GENERIC_ERROR }, 401);

    let email: string | undefined;
    const { data: link } = await cloud
      .from("username_login_links")
      .select("email")
      .eq("legacy_user_id", profile.user_id)
      .maybeSingle();
    email = link?.email;
    if (!email && LEGACY_SERVICE) {
      // Optional fallback when a real legacy service key is configured.
      const legacyAdmin = createClient(LEGACY_URL, LEGACY_SERVICE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData } = await legacyAdmin.auth.admin.getUserById(profile.user_id);
      email = userData?.user?.email ?? undefined;
    }
    if (!email) return json({ error: GENERIC_ERROR }, 401);

    const legacyAnon = createClient(LEGACY_URL, LEGACY_ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await legacyAnon.auth.signInWithPassword({ email, password });
    if (error || !data?.session) return json({ error: GENERIC_ERROR }, 401);

    // Session tokens only — never the email, never user metadata.
    return json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
    });
  }

  return json({ error: "Unknown action" }, 400);
});
