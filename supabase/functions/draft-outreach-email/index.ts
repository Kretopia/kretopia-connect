// draft-outreach-email
// Drafts a personalized cold-outreach pitch from a sponsor_lead (or brand_name) and
// saves it to outreach_drafts as status='draft' for owner review.
//
// Body: { lead_id?: string, brand_name?: string, angle?: string, _agent_action_id?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI not configured" }, 500);
    }

    const auth = req.headers.get("authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    let userId: string | undefined = body.user_id;

    if (!isCron) {
      if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: auth } },
      });
      const token = auth.replace("Bearer ", "");
      const { data, error } = await (userClient.auth as any).getClaims(token);
      if (error || !data?.claims) return json({ error: "unauthorized" }, 401);
      userId = data.claims.sub as string;
    }
    if (!userId) return json({ error: "user_id required" }, 400);

    const leadId: string | undefined = body.lead_id;
    const angle: string = (body.angle || "").toString().slice(0, 400);
    let brandName: string | undefined = body.brand_name;

    // Pull lead context if provided
    let lead: any = null;
    if (leadId) {
      const { data } = await admin
        .from("sponsor_leads")
        .select("*")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      lead = data;
      brandName = brandName || lead?.brand_name;
    }
    if (!brandName) return json({ error: "lead_id or brand_name required" }, 400);

    // Pull creator context
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, primary_role, sub_roles, skills, location, country, bio, site_headline")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: memories } = await admin
      .from("thrive_memory")
      .select("kind, mem_key, label, body")
      .eq("user_id", userId)
      .in("kind", ["rate", "client", "vendor", "preference", "fact", "contact"])
      .limit(20);

    const memorySnippet = (memories || [])
      .map((m: any) => `- [${m.kind}] ${m.label || m.mem_key}: ${(m.body ?? "").toString().slice(0, 200)}`)
      .join("\n");

    const tools = [
      {
        type: "function",
        function: {
          name: "emit_outreach_email",
          description: "Emit a personalized cold-outreach email",
          parameters: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Punchy 4-7 word subject line, no clickbait" },
              body: {
                type: "string",
                description:
                  "4-6 short sentences. Warm, human, specific. Mention one concrete reason this brand fits this creator. End with a soft single ask (15-min call or share a one-pager). No emojis. Sign with creator's first name.",
              },
              recipient_hint: { type: "string", description: "Best-guess role/title to address (e.g. Head of Partnerships)" },
            },
            required: ["subject", "body"],
          },
        },
      },
    ];

    const sysPrompt =
      "You are a senior creator-economy partnerships agent. You draft outreach emails that sound like the creator wrote them — warm, specific, no marketing fluff, no emojis, no hype words. Always reference one concrete reason the brand fits THIS creator (audience, past work, niche overlap). Keep it under 110 words.";

    const userPrompt = `Brand: ${brandName}
${lead ? `Brand fit reason from research: ${lead.reason || "(none)"}\nNiche: ${lead.niche || "(unknown)"}\nFit score: ${lead.fit_score}/100` : ""}
${angle ? `Positioning angle: ${angle}` : ""}

Creator:
- Name: ${profile?.display_name || "(unnamed)"}
- Role: ${profile?.primary_role || ""}
- Headline: ${profile?.site_headline || ""}
- Skills: ${(profile?.skills || []).slice(0, 10).join(", ")}
- Region: ${profile?.location || profile?.country || ""}
- Bio: ${(profile?.bio || "").slice(0, 400)}

${memorySnippet ? `Creator memory (use sparingly, only if relevant):\n${memorySnippet}` : ""}

Draft the email now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_outreach_email" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limited, try again later." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No draft produced" }, 500);

    let parsed: { subject?: string; body?: string; recipient_hint?: string } = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      return json({ error: "Bad AI output" }, 500);
    }

    if (!parsed.subject || !parsed.body) return json({ error: "Incomplete draft" }, 500);

    // Insert draft
    const { data: draft, error: insErr } = await admin
      .from("outreach_drafts")
      .insert({
        user_id: userId,
        lead_id: leadId || null,
        source: lead ? "sponsor_radar" : "manual",
        recipient_name: parsed.recipient_hint || null,
        recipient_email: lead?.contact_info?.email || null,
        brand_name: brandName,
        subject: parsed.subject.slice(0, 200),
        body: parsed.body.slice(0, 4000),
        status: "draft",
        meta: { angle: angle || null, fit_score: lead?.fit_score || null },
      })
      .select()
      .single();

    if (insErr) {
      console.error("insert draft err", insErr);
      return json({ error: insErr.message }, 500);
    }

    return json({ ok: true, draft });
  } catch (e) {
    console.error("draft-outreach-email error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
