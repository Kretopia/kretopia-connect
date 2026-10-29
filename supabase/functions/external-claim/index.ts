// External claim: a visitor looks at a listing, a signed-in claimant redeems a claim link, proves control of the
// publisher's own domain (or asks for an admin review), and then manages ONLY that listing. Redeeming a link opens a
// pending claim and proves nothing. The user id used for every write is the signed-in user's, never one from the body.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { requireUser } from "../_shared/require-user.ts";
import { corsHeaders, isUuid, json, readJson, respond } from "../_shared/discovery/http.ts";
import { claimStatus, disputeListing, ownerUpdate, redeemClaim, requestAdminReview, startVerification, verifyDomain, type PipelineDeps } from "../_shared/discovery/pipeline.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json({ ok: false, code: "bad_request", message: "Send a JSON object." }, 400);
  const action = String(body.action ?? "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const deps: PipelineDeps = { rpc: (n, a) => admin.rpc(n, a), from: (t) => admin.from(t), claimSecret: Deno.env.get("CLAIM_CHALLENGE_SECRET") ?? undefined, env: Deno.env };

  // The only public action: what the listing page shows (the public view has no internal column).
  if (action === "preview") {
    if (!isUuid(body.listing_id)) return json({ ok: false, code: "bad_request" }, 400);
    const { data } = await admin.from("public_external_listings").select("id, kind, title, original_publisher, claimed").eq("id", body.listing_id).maybeSingle();
    return data ? json({ ok: true, listing: data }) : json({ ok: false, code: "not_found" }, 404);
  }

  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;
  const userId = guard.userId;
  const limit = await checkAiFeatureRateLimit(admin, userId, "external-claim", 60);
  if (!limit.allowed) return limit.response;

  switch (action) {
    case "redeem":
      return isUuid(body.listing_id) ? respond(await redeemClaim(deps, userId, body.listing_id, body.token)) : json({ ok: false, code: "bad_request" }, 400);
    case "start":
      return isUuid(body.claim_id) ? respond(await startVerification(deps, userId, body.claim_id)) : json({ ok: false, code: "bad_request" }, 400);
    case "verify_domain":
      return isUuid(body.claim_id) ? respond(await verifyDomain(deps, userId, body.claim_id)) : json({ ok: false, code: "bad_request" }, 400);
    case "request_review":
      return isUuid(body.claim_id) ? respond(await requestAdminReview(deps, userId, body.claim_id)) : json({ ok: false, code: "bad_request" }, 400);
    case "status":
      return isUuid(body.listing_id) ? respond(await claimStatus(deps, userId, body.listing_id)) : json({ ok: false, code: "bad_request" }, 400);
    case "owner_update":
      return isUuid(body.listing_id) && body.edits && typeof body.edits === "object" ? respond(await ownerUpdate(deps, userId, body.listing_id, body.edits as Record<string, unknown>)) : json({ ok: false, code: "bad_request" }, 400);
    case "dispute":
      return isUuid(body.listing_id) ? respond(await disputeListing(deps, userId, body.listing_id, String(body.reason ?? ""))) : json({ ok: false, code: "bad_request" }, 400);
    default:
      return json({ ok: false, code: "unknown_action" }, 400);
  }
});
