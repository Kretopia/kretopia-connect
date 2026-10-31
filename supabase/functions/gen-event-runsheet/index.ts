// Generate an event run sheet from a brief.
// Returns an array of timeline items the client inserts into event_runsheet_items.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
const BodySchema = z.object({ event_title: z.string().max(1000), event_description: z.string().max(24000).nullish(), event_date: z.string().max(100).nullish(), duration_hours: z.number().finite().nullish() });

const SYSTEM = `You are an event producer. Build a tight, realistic run sheet for the event described. Use 24h times. Cover load-in through wrap. Each item: short title, owner role (e.g. Stage Manager, AV Lead, Host), and a one-line note. Aim for 8-14 items.`;

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireAiCaller(req, 'gen-event-runsheet');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const { event_title, event_description, event_date, duration_hours } = await readJson(req, BodySchema);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: SYSTEM + PROMPT_INJECTION_DEFENSE_CLAUSE },
          { role: "user", content: wrapUntrustedContent("event input", `Event: ${event_title}\n${event_description || ""}\nDate: ${event_date || "TBD"}\nDuration: ~${duration_hours || 4}h`) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_runsheet",
            description: "Return the run sheet items.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start_time: { type: "string", description: "HH:MM 24h" },
                      end_time: { type: "string", description: "HH:MM 24h" },
                      title: { type: "string" },
                      owner_name: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["start_time", "end_time", "title", "owner_name", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_runsheet" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "Out of AI credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return safeError(new Error("AI gateway request failed"), req);
    }
    const data = await resp.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return safeError(e, req);
  }
});
