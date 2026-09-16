import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptToken, verifyState } from "../_shared/import/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://kretopia.com";

async function exchange(provider: string, code: string, redirectUri: string) {
  if (provider === "notion") {
    const id = Deno.env.get("NOTION_CLIENT_ID")!;
    const secret = Deno.env.get("NOTION_CLIENT_SECRET")!;
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error_description ?? JSON.stringify(body));
    return {
      access_token: body.access_token,
      refresh_token: null,
      expires_in: null,
      account_id: body.workspace_id ?? body.bot_id ?? null,
      account_name: body.workspace_name ?? "Notion workspace",
      scopes: ["read_content"],
    };
  }
  if (provider === "monday") {
    const res = await fetch("https://auth.monday.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("MONDAY_CLIENT_ID"),
        client_secret: Deno.env.get("MONDAY_CLIENT_SECRET"),
        code,
        redirect_uri: redirectUri,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? JSON.stringify(body));
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? null,
      expires_in: body.expires_in ?? null,
      account_id: String(body.account_id ?? ""),
      account_name: "monday.com account",
      scopes: String(body.scope ?? "").split(" ").filter(Boolean),
    };
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const back = (qs: string) => Response.redirect(`${APP_URL}/studio-import?${qs}`, 302);

  try {
    if (err) return back(`connect_error=${encodeURIComponent(err)}`);
    if (!code || !state) return back("connect_error=missing_code");

    const payload = await verifyState(state);
    const provider = String(payload.provider);
    const userId = String(payload.user_id);
    const redirectUri = `${SUPABASE_URL}/functions/v1/integration-oauth-callback`;

    const tok = await exchange(provider, code, redirectUri);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    await admin.from("integration_connections")
      .update({ revoked_at: new Date().toISOString(), connection_status: "replaced" })
      .eq("user_id", userId).eq("provider", provider).is("revoked_at", null);

    const { error } = await admin.from("integration_connections").insert({
      user_id: userId,
      provider,
      provider_account_id: tok.account_id,
      provider_account_name: tok.account_name,
      encrypted_access_token: await encryptToken(tok.access_token),
      encrypted_refresh_token: tok.refresh_token ? await encryptToken(tok.refresh_token) : null,
      token_expiry: tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString() : null,
      granted_scopes: tok.scopes,
      connection_status: "active",
    });
    if (error) throw new Error(error.message);

    return back(`connected=${provider}`);
  } catch (e) {
    console.error("integration-oauth-callback failed:", e);
    return back(`connect_error=${encodeURIComponent((e as Error).message)}`);
  }
});
