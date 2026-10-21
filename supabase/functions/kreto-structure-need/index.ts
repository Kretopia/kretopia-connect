// Kreto reads a company's hiring brief and turns it into the criteria a search can check. It is the ONLY thing the model
// does for matching: it never sees a profile, never ranks anyone, never writes a reason about a person, and never produces a
// score. Profiles are checked and ranked by deterministic rules in the app (src/lib/matching), so a profile's own text
// cannot steer the result and nothing about a person is sent to the provider.
//
// What reaches the model: the brief, wrapped as untrusted data, and a fixed instruction. What leaves this function: a
// need rebuilt field by field from whatever the model returned (sanitizeNeed), so an invented field, a wrong enum value, an
// over-long string or an instruction hidden in the brief cannot become anything but a dropped entry. The app validates the
// answer again with the same schema before showing it, and the person reviews and edits the criteria before any search.
//
// One file on purpose: it is deployed by pasting it. It needs only shared files production already has (require-user,
// aiRateLimit, aiModels, promptIsolation, fetchWithTimeout) and no database change.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireUser } from "../_shared/require-user.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { PROMPT_INJECTION_DEFENSE_CLAUSE, wrapUntrustedContent } from "../_shared/promptIsolation.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Kept in step by hand with src/lib/matching/need.ts (there is no shared import between the app and an edge function);
// a test fails if they drift.
export const CRAFTS = ["software", "fashion", "music", "photo_video", "design", "writing", "dance", "crew", "model", "creator"] as const;
export const PLATFORMS = ["tiktok", "instagram", "youtube", "spotify", "soundcloud", "behance"] as const;
const IMPORTANCE = ["required", "preferred"] as const;

export const BRIEF_MIN = 10;
export const BRIEF_MAX = 800;
const PROVIDER_TIMEOUT_MS = 25_000;

type Importance = (typeof IMPORTANCE)[number];
export interface Need {
  craft?: { category: (typeof CRAFTS)[number]; importance: Importance };
  skills: Array<{ term: string; importance: Importance }>;
  themes: Array<{ term: string; importance: Importance }>;
  location?: { text: string; remoteOk: boolean; importance: Importance };
  platforms: Array<{ platform: (typeof PLATFORMS)[number]; minAudience?: number; importance: Importance }>;
  audience?: { description: string; importance: Importance };
  backedWork?: Importance;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// deno-lint-ignore no-control-regex
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max).trim() : "");
const importanceOf = (v: unknown, fallback: Importance): Importance => (v === "required" || v === "preferred" ? v : fallback);

function terms(raw: unknown, cap: number): Array<{ term: string; importance: Importance }> {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Array<{ term: string; importance: Importance }> = [];
  for (const entry of raw.slice(0, 30)) {
    if (!isRecord(entry)) continue;
    const term = clean(entry.term, 40);
    if (term.length < 2 || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    // An importance the model did not state clearly is "preferred": nothing becomes a must by accident.
    out.push({ term, importance: importanceOf(entry.importance, "preferred") });
    if (out.length === cap) break;
  }
  return out;
}

/** Rebuilds a need from the model's answer, field by field. Anything unrecognised is dropped, never passed through. */
export function sanitizeNeed(raw: unknown): { need: Need; ignored: string[] } {
  const input = isRecord(raw) ? raw : {};
  const need: Need = { skills: terms(input.skills, 8), themes: terms(input.themes, 6), platforms: [] };

  if (isRecord(input.craft) && (CRAFTS as readonly unknown[]).includes(input.craft.category)) {
    need.craft = { category: input.craft.category as (typeof CRAFTS)[number], importance: importanceOf(input.craft.importance, "preferred") };
  }

  if (isRecord(input.location)) {
    const text = clean(input.location.text, 80);
    if (text.length >= 2) need.location = { text, remoteOk: input.location.remoteOk === true, importance: importanceOf(input.location.importance, "preferred") };
  }

  if (Array.isArray(input.platforms)) {
    const seen = new Set<string>();
    for (const entry of input.platforms.slice(0, 12)) {
      if (!isRecord(entry) || !(PLATFORMS as readonly unknown[]).includes(entry.platform) || seen.has(entry.platform as string)) continue;
      seen.add(entry.platform as string);
      const min = typeof entry.minAudience === "number" ? entry.minAudience : Number.NaN;
      const item: Need["platforms"][number] = { platform: entry.platform as (typeof PLATFORMS)[number], importance: importanceOf(entry.importance, "preferred") };
      if (Number.isInteger(min) && min >= 1 && min <= 1_000_000_000) item.minAudience = min;
      need.platforms.push(item);
      if (need.platforms.length === 4) break;
    }
  }

  if (isRecord(input.audience)) {
    const description = clean(input.audience.description, 120);
    if (description.length >= 3) need.audience = { description, importance: importanceOf(input.audience.importance, "preferred") };
  }

  if (input.backedWork === "required" || input.backedWork === "preferred") need.backedWork = input.backedWork;

  const ignored = Array.isArray(input.ignored) ? input.ignored.map((v) => clean(v, 80)).filter((v) => v.length >= 2).slice(0, 6) : [];
  return { need, ignored };
}

export const criteriaCount = (n: Need): number =>
  (n.craft ? 1 : 0) + n.skills.length + n.themes.length + (n.location ? 1 : 0) + n.platforms.length + (n.audience ? 1 : 0) + (n.backedWork ? 1 : 0);

const importanceSchema = { type: "string", enum: [...IMPORTANCE] };
const termList = (max: number) => ({
  type: "array",
  maxItems: max,
  items: {
    type: "object",
    properties: { term: { type: "string", description: "A short word or phrase, as the brief says it." }, importance: importanceSchema },
    required: ["term", "importance"],
    additionalProperties: false,
  },
});

export const TOOL = {
  type: "function",
  function: {
    name: "structure_need",
    description: "Set the search criteria stated by the brief. Leave out anything the brief does not say.",
    parameters: {
      type: "object",
      properties: {
        craft: { type: "object", properties: { category: { type: "string", enum: [...CRAFTS] }, importance: importanceSchema }, required: ["category", "importance"], additionalProperties: false },
        skills: termList(8),
        themes: { ...termList(6), description: "Subjects or product types the creator should already have worked on." },
        location: { type: "object", properties: { text: { type: "string" }, remoteOk: { type: "boolean" }, importance: importanceSchema }, required: ["text", "remoteOk", "importance"], additionalProperties: false },
        platforms: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: { platform: { type: "string", enum: [...PLATFORMS] }, minAudience: { type: "integer", minimum: 1 }, importance: importanceSchema },
            required: ["platform", "importance"],
            additionalProperties: false,
          },
        },
        audience: { type: "object", properties: { description: { type: "string" }, importance: importanceSchema }, required: ["description", "importance"], additionalProperties: false },
        backedWork: { ...importanceSchema, description: "Only if the brief asks for verified or proven past work." },
        ignored: { type: "array", maxItems: 6, items: { type: "string" }, description: "Parts of the brief that are not searchable criteria, such as budget, deadline or deliverables, as short phrases." },
      },
      additionalProperties: false,
    },
  },
} as const;

export const SYSTEM_PROMPT = `You turn a company's hiring brief into search criteria for a directory of creative professionals. You only fill the fields of the tool. You never name or describe any person, and you never give a score.

Rules:
- Use only what the brief states or plainly implies. If the brief does not say it, leave the field out. Never guess a location, a platform, a skill or an audience.
- "required" only when the brief makes it a must (must, need, essential, only, required). Use "preferred" for nice-to-have wording and whenever it is unclear.
- craft: choose one category only when the brief clearly names the kind of creative. TikTok/Instagram influencers, UGC creators and streamers are "creator".
- audience: only when the brief explicitly says who the audience must be. Never infer an audience from the product, the place or the platform.
- Budget, deadline, deliverables, usage rights and anything else that is not a searchable criterion go in "ignored", as short phrases.
- Keep terms short, in the language of the brief.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

export function buildMessages(brief: string) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: wrapUntrustedContent("company brief", brief) },
  ];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  let brief = "";
  try {
    const body = await req.json();
    brief = typeof body?.brief === "string" ? body.brief.trim() : "";
  } catch {
    return json({ error: "brief_invalid" }, 400);
  }
  if (brief.length < BRIEF_MIN || brief.length > BRIEF_MAX) return json({ error: "brief_invalid" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "ai_not_configured" }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const gate = await checkAiFeatureRateLimit(admin, guard.userId, "kreto-structure-need");
  if (!gate.allowed) return gate.response;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: GEMINI_3_FLASH, messages: buildMessages(brief), tools: [TOOL], tool_choice: { type: "function", function: { name: "structure_need" } } }),
      },
      PROVIDER_TIMEOUT_MS,
    );
  } catch (error) {
    // The brief is never logged, here or below.
    console.error("kreto-structure-need: provider call failed", error instanceof Error ? error.name : "unknown");
    return json({ error: error instanceof Error && error.name === "AbortError" ? "timeout" : "provider_error" }, error instanceof Error && error.name === "AbortError" ? 504 : 502);
  }

  if (!response.ok) {
    if (response.status === 429) return json({ error: "rate_limited" }, 429);
    if (response.status === 402) return json({ error: "ai_credits" }, 402);
    console.error("kreto-structure-need: provider status", response.status);
    return json({ error: "provider_error" }, 502);
  }

  let args: unknown;
  try {
    const data = await response.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    args = call?.function?.name === "structure_need" ? JSON.parse(call.function.arguments) : undefined;
  } catch {
    args = undefined;
  }
  if (args === undefined) return json({ error: "invalid_output" }, 502);

  const { need, ignored } = sanitizeNeed(args);
  if (criteriaCount(need) === 0) return json({ error: "no_criteria", ignored }, 422);
  return json({ need, ignored });
};

serve(handler);
