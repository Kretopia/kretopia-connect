// Generates a tight set of podcast interview questions for a guest/episode.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
const BodySchema = z.object({ episode_title: z.string().min(1).max(1000), guest_names: z.array(z.string().max(255)).max(100).default([]), show_concept: z.string().max(16000).nullish(), notes: z.string().max(16000).nullish() });

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireAiCaller(req, 'gen-podcast-questions');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { episode_title, guest_names = [], show_concept, notes } = await readJson(req, BodySchema);

    if (!episode_title) {
      return new Response(JSON.stringify({ error: "episode_title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Show concept: ${show_concept || "(not specified)"}
Episode: ${episode_title}
Guest(s): ${guest_names.length ? guest_names.join(", ") : "(no guests yet)"}
Producer notes: ${notes || "(none)"}

Generate 8 interview questions: 1 warm opener, 5 substantive (story, craft, turning points, opinions), 1 challenge/spicy, 1 closer that prompts a great soundbite. Avoid generic "tell us about yourself".`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: "You are a senior podcast producer. Craft sharp, specific, conversational interview questions. No filler." + PROMPT_INJECTION_DEFENSE_CLAUSE },
          { role: "user", content: wrapUntrustedContent("podcast input", userPrompt) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_questions",
            description: "Return the interview questions.",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["opener", "substantive", "challenge", "closer"] },
                      text: { type: "string" },
                    },
                    required: ["kind", "text"],
                    additionalProperties: false,
                  },
                  minItems: 6,
                  maxItems: 10,
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Workspace AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return safeError(new Error("AI gateway request failed"), req);
    }

    const data = await resp.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = tc ? JSON.parse(tc.function.arguments) : { questions: [] };
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return safeError(e, req);
  }
});
