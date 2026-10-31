import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
const BodySchema = z.object({ brief: z.string().max(24000).nullish(), project_title: z.string().max(1000).nullish(), brand_name: z.string().max(1000).nullish(), objective: z.string().max(4000).nullish(), audience: z.string().max(4000).nullish(), tone: z.string().max(1000).nullish() });

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, 'gen-campaign-matrix');
    const { brief, project_title, brand_name, objective, audience, tone } = await readJson(req, BodySchema);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are a senior brand campaign strategist. Given a brief, draft a concrete asset matrix across paid + organic channels. Return 8-14 deliverables with: platform (instagram/tiktok/youtube/x/linkedin/email/ooh/web), format (reel/carousel/story/30s spot/static/banner/newsletter), deliverable (one short line), channel (paid|organic|both), notes (one short line). Be specific to the brand and audience. No fluff.`;

    const user = `BRAND: ${brand_name || "—"}
PROJECT: ${project_title || "—"}
OBJECTIVE: ${objective || "—"}
AUDIENCE: ${audience || "—"}
TONE: ${tone || "—"}
BRIEF:
${brief || "(no brief)"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: sys + PROMPT_INJECTION_DEFENSE_CLAUSE },
          { role: "user", content: wrapUntrustedContent("production input", user) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "draft_matrix",
            description: "Return campaign asset matrix",
            parameters: {
              type: "object",
              properties: {
                assets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      platform: { type: "string" },
                      format: { type: "string" },
                      deliverable: { type: "string" },
                      channel: { type: "string", enum: ["paid", "organic", "both"] },
                      notes: { type: "string" },
                    },
                    required: ["deliverable", "channel"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["assets"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "draft_matrix" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again soon." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI error");
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { assets: [] };
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return safeError(e, req);
  }
});
