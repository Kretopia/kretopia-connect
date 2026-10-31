// The bounded discovery run. DISABLED BY DEFAULT: nothing happens while discovery_settings.enabled is false, a source is
// off until a person enables it with a known cost, and every result is a private review DRAFT (never published).
// Manual: an admin calls it. Scheduled: the same call with the existing cron secret, only once a person has created the
// schedule (see docs/release/EXTERNAL_DISCOVERY.md); this function creates no schedule itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { corsHeaders, json as requestJson, parseRunSources } from "../_shared/discovery/http.ts";
import { runDiscovery, type PipelineDeps } from "../_shared/discovery/pipeline.ts";
import { readJson, safeError } from "../_shared/guard.ts";
import { z } from "npm:zod@4";

const runSchema = z.object({ sources: z.unknown().optional(), slot: z.string().max(24).optional() });

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => requestJson(req, body, status);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
  const body = await readJson(req, runSchema);
  // Optional: only these sources. A source that must not be read again today (a once-a-day feed) is left out by naming the others.
  // A bad list is refused before anything is touched.
  const only = parseRunSources(body.sources);
  if (only === "invalid") return json({ ok: false, code: "bad_request", message: "sources must be a list of up to 8 source ids." }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const deps: PipelineDeps = { rpc: (n, a) => admin.rpc(n, a), from: (t) => admin.from(t), env: Deno.env };

  // Abandoned reservations are marked first; they stay counted for the day until a person reconciles them.
  await admin.rpc("expire_discovery_spend");
  const slot = typeof body.slot === "string" && /^[a-z0-9-]{1,24}$/.test(body.slot) ? body.slot : "run";
  const result = await runDiscovery(deps, { slot, ...(only ? { only } : {}) });
  return json({ ok: true, ...result, ...(only ? { only } : {}), via: guard.viaCron ? "schedule" : "manual" });
  } catch (error) {
    return safeError(error, req);
  }
});
