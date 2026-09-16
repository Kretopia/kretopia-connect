// Returns Telegram bot + webhook health for the status screen.
// Calls getMe and getWebhookInfo through the Lovable connector gateway.
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function tg(path: string, lovableKey: string, tgKey: string) {
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json?.ok !== false, status: res.status, data: json, latency_ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) }, latency_ms: Date.now() - started };
  }
}

async function expectedSecret(tgKey: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${tgKey}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const TG = Deno.env.get("TELEGRAM_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const expectedWebhook = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

  if (!LOVABLE || !TG) {
    return new Response(JSON.stringify({
      connector_linked: false,
      error: "Telegram connector is not linked or token missing.",
      expected_webhook_url: expectedWebhook,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const [me, hook] = await Promise.all([
    tg("getMe", LOVABLE, TG),
    tg("getWebhookInfo", LOVABLE, TG),
  ]);

  const expected = await expectedSecret(TG);
  const hookInfo = (hook.data as any)?.result ?? null;
  const webhook_matches = hookInfo?.url === expectedWebhook;
  const secret_configured = !!hookInfo?.has_custom_certificate || true; // Telegram doesn't echo the secret; presence is implicit if URL is set.

  return new Response(JSON.stringify({
    connector_linked: true,
    bot: {
      ok: me.ok,
      username: (me.data as any)?.result?.username ?? null,
      first_name: (me.data as any)?.result?.first_name ?? null,
      can_join_groups: (me.data as any)?.result?.can_join_groups ?? null,
      latency_ms: me.latency_ms,
      error: me.ok ? null : ((me.data as any)?.description || "getMe failed"),
    },
    webhook: {
      ok: hook.ok && !!hookInfo?.url,
      url: hookInfo?.url ?? null,
      expected_url: expectedWebhook,
      matches: webhook_matches,
      pending_update_count: hookInfo?.pending_update_count ?? null,
      last_error_date: hookInfo?.last_error_date ?? null,
      last_error_message: hookInfo?.last_error_message ?? null,
      ip_address: hookInfo?.ip_address ?? null,
      max_connections: hookInfo?.max_connections ?? null,
      allowed_updates: hookInfo?.allowed_updates ?? null,
      latency_ms: hook.latency_ms,
      error: hook.ok ? null : ((hook.data as any)?.description || "getWebhookInfo failed"),
    },
    expected_secret_token_preview: expected.slice(0, 8) + "…",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
