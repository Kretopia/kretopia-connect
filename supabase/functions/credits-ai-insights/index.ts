import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * credits-ai-insights — read-only analysis of the CALLER's own Credits data.
 *
 * Security model:
 *  - The user is derived from the Authorization JWT. A client-supplied
 *    user_id is never trusted or accepted.
 *  - All data is read with the caller's own token (RLS applies) plus the
 *    two auth-scoped RPCs (search_my_credits / my_credits_overview).
 *  - The function NEVER writes. It cannot verify a credit, change a stamp,
 *    publish a profile, touch XP/badges or send anything. It returns
 *    suggestions that the UI requires the human to review and confirm.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INSIGHTS = 4;
const MAX_LEN = 400;

const clamp = (v: unknown, n = MAX_LEN) =>
  typeof v === "string" ? v.slice(0, n) : "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Personal scope only ────────────────────────────────────────────
    const [{ data: overviewRows }, { data: credits }, { data: profile }] =
      await Promise.all([
        supabase.rpc("my_credits_overview"),
        supabase.rpc("search_my_credits", { p_query: "", p_limit: 40 }),
        supabase
          .from("profiles")
          .select(
            "full_name, role, bio, avatar_url, location, availability_status, collab_intent, hourly_rate, project_rate, rate_currency, skills",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    const overview = Array.isArray(overviewRows) ? overviewRows[0] : overviewRows;
    const creditList = (credits || []) as any[];

    const scope = [
      "your own credits",
      "your own profile identity fields",
      "your own Hire Me fields",
    ];

    const compact = creditList.slice(0, 30).map((c) => ({
      project: c.project_name,
      role: c.role,
      year: c.year,
      status: c.verification_status || "pending",
      has_evidence: Boolean(c.url || c.primary_media_url),
      cosigns: c.endorsement_count || 0,
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ insights: [], degraded: true, reason: "ai_unavailable", scope }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              `You are Kreto, Kretopia's creative-career operator. You review ONE person's own credits record and suggest concrete next actions.
Rules:
- Only use the data given. Never invent a credit, a client, a collaborator or a number.
- Never claim a credit is verified. Verification is a human, co-signed process.
- Suggest at most ${MAX_INSIGHTS} actions, highest-leverage first.
- Every suggestion must name the exact data it came from and say plainly how sure you are.
- Where the action is "rewrite this text", provide a draft the person can edit. No emojis.
- Speak in first person, warm and direct. Short sentences.`,
          },
          {
            role: "user",
            content: JSON.stringify({ overview, profile, credits: compact }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_credit_insights",
              description: "Return reviewed suggestions for this person's credits record.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "One or two sentences summarising their verified work." },
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        kind: {
                          type: "string",
                          enum: ["evidence", "bio", "hire_me", "credit", "verification", "activity"],
                        },
                        title: { type: "string" },
                        body: { type: "string" },
                        reason: { type: "string", description: "Which data point led to this." },
                        confidence: { type: "string", enum: ["low", "medium", "high"] },
                        draft: { type: "string", description: "Optional editable draft text." },
                        target_field: {
                          type: "string",
                          enum: ["bio", "site_headline", "availability_note", "none"],
                        },
                      },
                      required: ["id", "kind", "title", "body", "reason", "confidence", "target_field"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_credit_insights" } },
      }),
    });

    if (res.status === 429 || res.status === 402) {
      return new Response(
        JSON.stringify({ insights: [], degraded: true, reason: res.status === 429 ? "rate_limited" : "quota", scope }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) throw new Error(`ai_gateway_${res.status}`);

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try {
      parsed = JSON.parse(call?.function?.arguments || "{}");
    } catch {
      parsed = {};
    }

    // Schema-validate + bound everything before it reaches the browser.
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, MAX_INSIGHTS).map((i: any, idx: number) => ({
          id: clamp(i?.id, 60) || `insight-${idx}`,
          kind: ["evidence", "bio", "hire_me", "credit", "verification", "activity"].includes(i?.kind)
            ? i.kind
            : "activity",
          title: clamp(i?.title, 90),
          body: clamp(i?.body),
          reason: clamp(i?.reason, 220),
          confidence: ["low", "medium", "high"].includes(i?.confidence) ? i.confidence : "low",
          draft: clamp(i?.draft, 600) || null,
          target_field: ["bio", "site_headline", "availability_note"].includes(i?.target_field)
            ? i.target_field
            : "none",
        })).filter((i: any) => i.title && i.body)
      : [];

    return new Response(
      JSON.stringify({
        summary: clamp(parsed.summary, 320),
        insights,
        scope,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("credits-ai-insights error", err);
    return new Response(
      JSON.stringify({ insights: [], degraded: true, reason: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
