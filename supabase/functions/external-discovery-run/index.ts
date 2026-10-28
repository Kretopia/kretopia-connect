// The bounded discovery run. DISABLED BY DEFAULT: nothing happens while discovery_settings.enabled is false, a source is
// off until a person enables it with a known cost, and every result is a private review DRAFT (never published).
// Manual: an admin calls it. Scheduled: the same call with the existing cron secret, only once a person has created the
// schedule (see docs/release/EXTERNAL_DISCOVERY.md); this function creates no schedule itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { corsHeaders, json, readJson } from "../_shared/discovery/http.ts";
import { runDiscovery, type PipelineDeps } from "../_shared/discovery/pipeline.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const body = (await readJson(req)) ?? {};
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const deps: PipelineDeps = { rpc: (n, a) => admin.rpc(n, a), from: (t) => admin.from(t), env: Deno.env };

  // Abandoned reservations are marked first; they stay counted for the day until a person reconciles them.
  await admin.rpc("expire_discovery_spend");
  const slot = typeof body.slot === "string" && /^[a-z0-9-]{1,24}$/.test(body.slot) ? body.slot : "run";
  const result = await runDiscovery(deps, { slot });
  return json({ ok: true, ...result, via: guard.viaCron ? "schedule" : "manual" });
});
