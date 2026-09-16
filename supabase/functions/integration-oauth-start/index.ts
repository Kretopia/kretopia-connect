import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { signState } from "../_shared/import/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CONFIG: Record<string, { authUrl: string; clientIdEnv: string; scopes?: string; extra?: Record<string, string> }> = {
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    clientIdEnv: "NOTION_CLIENT_ID",
    extra: { owner: "user", response_type: "code" },
  },
  monday: {
    authUrl: "https://auth.monday.com/oauth2/authorize",
    clientIdEnv: "MONDAY_CLIENT_ID",
    scopes: "boards:read workspaces:read users:read updates:read assets:read",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { provider, return_to } = await req.json();
    const cfg = CONFIG[provider];
    if (!cfg) return json({ error: `Unsupported provider: ${provider}` }, 400);

    const clientId = Deno.env.get(cfg.clientIdEnv);
    if (!clientId) return json({ error: `${provider} is not configured yet`, code: "not_configured" }, 400);

    const redirectUri = `${SUPABASE_URL}/functions/v1/integration-oauth-callback`;
    const state = await signState({ user_id: user.id, provider, return_to: return_to ?? "/studio-import" });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      ...(cfg.scopes ? { scope: cfg.scopes } : {}),
      ...(cfg.extra ?? {}),
    });

    return json({ url: `${cfg.authUrl}?${params.toString()}` });
  } catch (e) {
    console.error("integration-oauth-start failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
