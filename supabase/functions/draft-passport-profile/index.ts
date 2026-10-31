import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { TOKENS_STRUCTURED_SMALL } from "../_shared/aiLimits.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { requireUser } from "../_shared/require-user.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";
import {
  buildPhotoCandidates,
  buildWorkCandidates,
  factsCorpus,
  hasBioFacts,
  missingFields,
  needsModel,
  parseModelJson,
  resolveDraft,
  skillList,
  type CreditFacts,
  type ProfileFacts,
import { corsFor } from '../_shared/guard.ts';
} from "../_shared/passportDraft.ts";

// "Strengthen your Passport": one call drafts the pieces a Passport needs to be found (a bio, a photo, one work item)
// from what the signed-in person already has on Kretopia. Nothing is saved here and nothing is verified: the client
// shows the draft, the person accepts or rejects each field, and only accepted fields are written, by them.


const json = (corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You prepare a DRAFT of a creative professional's Passport profile. A person will review every field before anything is saved.

Rules:
- Use ONLY the FACTS you are given. Never invent employers, clients, credits, awards, numbers, places or verification.
- "bio": 1-2 first-person sentences, at most 240 characters, plain words. Name only things that appear in the FACTS. If the FACTS do not say enough to write an honest bio, return null.
- "photo_id": the id of the candidate image that looks most like a clear, professional portrait of one person, or null when none does.
- "work_id": the id of the candidate link that best represents the person's own work, or null when none does.
- Return a single JSON object {"bio": string|null, "photo_id": string|null, "work_id": string|null} and nothing else.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

async function askModel(apiKey: string, text: string, imageUrls: string[]) {
  const content: Part[] = [{ type: "text", text }, ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))];
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_3_FLASH,
      temperature: 0.2,
      max_tokens: TOKENS_STRUCTURED_SMALL,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content }],
    }),
  });
  return res;
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(corsHeaders, { ok: false, code: "method_not_allowed", error: "POST only" }, 405);

  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;
    const userId = guard.userId;

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    // Reads run as the person (their own rows, under RLS); only the usage counter needs the service role.
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const [{ data: profileRow, error: profileError }, { data: creditRows, error: creditError }, { data: authData }] = await Promise.all([
      db.from("profiles")
        .select("full_name, role, location, bio, avatar_url, professional_skills, website, imdb_url")
        .eq("user_id", userId)
        .maybeSingle(),
      db.from("credits")
        .select("project_name, role, url, thumbnail_url, primary_media_url, media_type")
        .eq("user_id", userId)
        .limit(25),
      db.auth.getUser(),
    ]);
    // An unreadable profile is a failure, not an empty profile: drafting from nothing would invite invention.
    if (profileError || creditError || !profileRow) {
      return json(corsHeaders, { ok: false, code: "profile_unreadable", error: "Could not read your profile." }, 500);
    }

    const profile = profileRow as ProfileFacts;
    const credits = (creditRows ?? []) as CreditFacts[];
    const meta = (authData?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const missing = missingFields(profile, credits.length);

    if (!missing.bio && !missing.photo && !missing.work_item) {
      return json(corsHeaders, { ok: true, missing, draft: { bio: null, photo: null, work_item: null }, unavailable: { bio: "already_complete", photo: "already_complete", work_item: "already_complete" } });
    }

    const photos = missing.photo ? buildPhotoCandidates(meta.avatar_url ?? meta.picture, credits) : [];
    const works = missing.work_item ? buildWorkCandidates(profile) : [];
    const corpus = factsCorpus(profile, credits);
    const bioFacts = hasBioFacts(profile, credits);

    // Nothing to write and nothing to choose from (the bio is fine or has no facts to rest on, no image, no link): no model call and
    // no usage counted. The reasons are the same ones a model call would have ended with.
    if (!needsModel({ missing, hasBioFacts: bioFacts, photos, works })) {
      const { draft, unavailable } = resolveDraft({ pick: {}, missing, profile, corpus, photos, works });
      return json(corsHeaders, { ok: true, missing, draft, unavailable });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json(corsHeaders, { ok: false, code: "ai_unavailable", error: "Drafting is not available right now." }, 503);

    const gate = await checkAiFeatureRateLimit(admin, userId, "draft-passport-profile");
    if (!gate.allowed) return gate.response;

    const facts = [
      `Name: ${profile.full_name ?? "unknown"}`,
      `Role: ${profile.role ?? "unknown"}`,
      `Location: ${profile.location ?? "unknown"}`,
      `Skills: ${skillList(profile.professional_skills).join(", ") || "none listed"}`,
      `Existing credits: ${credits.map((c) => `${c.project_name ?? "untitled"} (${c.role ?? "role unknown"})`).join("; ") || "none"}`,
    ].join("\n");
    const lists = [
      !missing.bio ? "The bio is already fine: return null for it." : bioFacts ? "Write the bio." : "There are too few facts for an honest bio: return null for it.",
      `Photo candidates (images attached in this order): ${photos.map((p) => p.id).join(", ") || "none"}`,
      `Link candidates: ${works.map((w) => `${w.id} = ${w.url}`).join("; ") || "none"}`,
    ].join("\n");
    const prompt = `${wrapUntrustedContent("profile facts", facts)}\n\n${lists}`;

    let res = await askModel(apiKey, prompt, photos.map((p) => p.url));
    let photoReadable = true;
    // A candidate image the gateway cannot fetch must not cost the person the bio: retry once without images.
    if (!res.ok && res.status !== 429 && res.status !== 402 && photos.length > 0) {
      photoReadable = false;
      res = await askModel(apiKey, prompt, []);
    }
    if (!res.ok) {
      if (res.status === 429) return json(corsHeaders, { ok: false, code: "rate_limited", error: "Too many requests. Try again in a minute." }, 429);
      if (res.status === 402) return json(corsHeaders, { ok: false, code: "ai_credits", error: "Drafting is paused: the AI credits are used up." }, 402);
      console.error("[draft-passport-profile] gateway", res.status);
      return json(corsHeaders, { ok: false, code: "ai_failed", error: "The draft could not be written. Try again." }, 502);
    }

    const body = await res.json();
    const pick = parseModelJson(body?.choices?.[0]?.message?.content);
    if (!pick) return json(corsHeaders, { ok: false, code: "ai_unreadable", error: "The draft could not be read. Try again." }, 502);

    const { draft, unavailable } = resolveDraft({ pick, missing, profile, corpus, photos: photoReadable ? photos : [], works });
    if (!photoReadable && missing.photo && photos.length > 0) unavailable.photo = "nothing_suitable";

    return json(corsHeaders, { ok: true, missing, draft, unavailable });
  } catch (e) {
    console.error("[draft-passport-profile]", e);
    return json(corsHeaders, { ok: false, code: "internal", error: "Something went wrong. Try again." }, 500);
  }
});
