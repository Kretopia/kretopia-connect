import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { TOKENS_SHORT_DRAFT } from "../_shared/aiLimits.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { requireUser } from "../_shared/require-user.ts";

// Onboarding's "Suggest a bio": one short model call that drafts a bio from what the signed-in person typed. Every call
// spends AI credits, so it needs a signed-in caller, is counted per person, and only takes a bounded prompt.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Well above what onboarding sends (a name, a role, a "City, Country", the skills Kreto found across a few searches),
// and small enough that a caller cannot use this function to push a large prompt at the model.
export const MAX_NAME = 120;
export const MAX_ROLE = 120;
export const MAX_LOCATION = 160;
export const MAX_SKILLS = 40;
export const MAX_SKILL = 80;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type BioInput = { fullName: string; role: string; location: string; skills: string[] };
type ReadInput = { ok: true; input: BioInput } | { ok: false; error: string };

// Turns the request body into trimmed, bounded text, or says which part the caller has to fix.
function readInput(body: unknown): ReadInput {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const role = typeof b.role === "string" ? b.role.trim() : "";
  if (!fullName || !role) return { ok: false, error: "Name and role are required" };
  if (fullName.length > MAX_NAME) return { ok: false, error: `Name is too long (${MAX_NAME} characters at most).` };
  if (role.length > MAX_ROLE) return { ok: false, error: `Role is too long (${MAX_ROLE} characters at most).` };

  if (b.location != null && typeof b.location !== "string") return { ok: false, error: "Location must be text." };
  const location = ((b.location as string | null | undefined) ?? "").trim();
  if (location.length > MAX_LOCATION) return { ok: false, error: `Location is too long (${MAX_LOCATION} characters at most).` };

  if (b.skills != null && (!Array.isArray(b.skills) || b.skills.some((s) => typeof s !== "string"))) {
    return { ok: false, error: "Skills must be a list of text." };
  }
  const listed = (b.skills as string[] | null | undefined) ?? [];
  // Checked on what was sent, before blanks are dropped, so padding the list with empty entries does not get past it.
  if (listed.length > MAX_SKILLS) return { ok: false, error: `Too many skills (${MAX_SKILLS} at most).` };
  const skills = listed.map((s) => s.trim()).filter(Boolean);
  if (skills.some((s) => s.length > MAX_SKILL)) return { ok: false, error: `A skill is too long (${MAX_SKILL} characters at most).` };

  return { ok: true, input: { fullName, role, location, skills } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Who is asking comes first: nothing below runs, and nothing is spent, for a caller that is not signed in.
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    const read = readInput(body);
    if (!read.ok) return json({ error: read.error }, 400);
    const { fullName, role, location, skills } = read.input;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Only the usage counter needs the service role. It runs after the input checks, so a refused request is not counted.
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const gate = await checkAiFeatureRateLimit(admin, guard.userId, "generate-bio");
    if (!gate.allowed) return gate.response;

    const prompt = `Write a professional, engaging bio (2-3 sentences, max 200 characters) for a creative professional's profile:

Name: ${fullName}
Role: ${role}
${location ? `Based in: ${location}` : ""}
${skills.length ? `Skills: ${skills.join(", ")}` : ""}

Guidelines:
- First person, confident but approachable
- Mention their craft and what makes them unique
- Keep it punchy and memorable — this is for a creative networking platform
- Do NOT include contact info, links, or hashtags
- Return ONLY the bio text, no quotes or labels`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_3_FLASH,
        messages: [{ role: "user", content: prompt }],
        max_tokens: TOKENS_SHORT_DRAFT,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      throw new Error(`AI request failed: ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const bio = data.choices?.[0]?.message?.content?.trim() || "";

    return json({ bio });
  } catch (e) {
    console.error("generate-bio error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
