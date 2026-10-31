// External import: a signed-in user turns an approved URL, pasted text or a screenshot into a PRIVATE review draft;
// a curator (admin) reviews, approves, and copies a claim link. Nothing here publishes on its own, sends a message, or
// applies anywhere. All rules live in _shared/discovery/pipeline.ts (tested); this file only wires auth and the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { requireUser } from "../_shared/require-user.ts";
import { corsHeaders, isUuid, json, readJson, respond } from "../_shared/discovery/http.ts";
import { createClaimLink, decideClaim, ingest, listFeedDrafts, reviewListing, setApplications, type IngestInput, type PipelineDeps } from "../_shared/discovery/pipeline.ts";

const ADMIN_ACTIONS = new Set(["review", "claim_link", "decide_claim", "set_applications", "list_review", "list_feed_drafts"]);
const LIST_FIELDS = "id, kind, status, visibility, title, original_publisher, location, source_type, source_url, apply_url, source_published_at, deadline_at, excerpt, flagged_instructions, possible_duplicates, extraction_issues, verification_status, last_checked_at, created_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, code: "method_not_allowed" }, 405);

  const body = await readJson(req);
  if (!body) return json(req, { ok: false, code: "bad_request", message: "Send a JSON object." }, 400);
  const action = String(body.action ?? "");

  // Admin actions need a real admin (not the cron secret); everything else needs any signed-in user.
  let userId: string;
  if (ADMIN_ACTIONS.has(action)) {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;
    if (!guard.userId) return json(req, { ok: false, code: "forbidden", message: "A signed-in admin is required." }, 403);
    userId = guard.userId;
  } else {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;
    userId = guard.userId;
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  const deps: PipelineDeps = {
    rpc: (name, args) => admin.rpc(name, args),
    from: (t) => admin.from(t),
    env: Deno.env,
    aiEnabled: Deno.env.get("EXTERNAL_AI_EXTRACTION") === "1" && !!aiKey,
    // A fixed, trusted endpoint. The model never chooses a URL, a tool or a permission.
    callModel: aiKey
      ? async (request) => {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(request) });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.choices?.[0]?.message?.content ?? null;
        }
      : undefined,
  };

  switch (action) {
    case "ingest": {
      const limit = await checkAiFeatureRateLimit(admin, userId, "external-import", 40);
      if (!limit.allowed) return limit.response;
      const input = body.input as IngestInput | undefined;
      if (!input || typeof input !== "object" || !["url", "text", "screenshot"].includes(String(input.type))) return json(req, { ok: false, code: "bad_request", message: "Unknown input." }, 400);
      const kind = ["gig", "event", "talent"].includes(String(body.kind)) ? (body.kind as "gig" | "event" | "talent") : "gig";
      return respond(req, await ingest(deps, userId, input, kind));
    }
    case "send_to_review":
      return isUuid(body.listing_id) ? respond(req, await reviewListing(deps, userId, body.listing_id, "send_to_review")) : json(req, { ok: false, code: "bad_request" }, 400);
    case "list_mine": {
      const { data } = await admin.from("external_listings").select(LIST_FIELDS).eq("created_by", userId).order("created_at", { ascending: false }).limit(100);
      return json(req, { ok: true, listings: data ?? [] });
    }
    case "list_feed_drafts":
      return json(req, { ok: true, ...(await listFeedDrafts(deps, LIST_FIELDS)) });
    case "list_review": {
      const { data } = await admin.from("external_listings").select(LIST_FIELDS).in("status", ["in_review", "published", "claimed"]).order("created_at", { ascending: false }).limit(200);
      const { data: claims } = await admin.from("external_listing_claims").select("id, listing_id, claimant_user_id, status, method, created_at").in("status", ["pending", "disputed"]).limit(200);
      return json(req, { ok: true, listings: data ?? [], claims: claims ?? [] });
    }
    case "review":
      return isUuid(body.listing_id) ? respond(req, await reviewListing(deps, userId, body.listing_id, String(body.decision ?? ""), typeof body.note === "string" ? body.note : undefined)) : json(req, { ok: false, code: "bad_request" }, 400);
    case "claim_link": {
      if (!isUuid(body.listing_id)) return json(req, { ok: false, code: "bad_request" }, 400);
      const origin = Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.kretopia.com";
      return respond(req, await createClaimLink(deps, userId, body.listing_id, origin));
    }
    case "decide_claim":
      return isUuid(body.claim_id) && (body.decision === "approve" || body.decision === "reject") ? respond(req, await decideClaim(deps, userId, body.claim_id, body.decision)) : json(req, { ok: false, code: "bad_request" }, 400);
    case "set_applications":
      return isUuid(body.listing_id) && typeof body.enabled === "boolean" ? respond(req, await setApplications(deps, userId, body.listing_id, body.enabled)) : json(req, { ok: false, code: "bad_request" }, 400);
    default:
      return json(req, { ok: false, code: "unknown_action" }, 400);
  }
});
