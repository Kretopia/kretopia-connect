import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
const BodySchema = z.object({
  title: z.string().max(1000).optional(),
  description: z.string().max(16000).optional(),
  category: z.string().max(255).optional(),
  type: z.string().max(100).optional(),
});

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAiCaller(req, 'enhance-listing-ai');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const { title, description, category, type } = await readJson(req, BodySchema);

    const systemPrompt = `You are a creative business copywriter for a professional creative platform.
Your job is to enhance service/product listings to be more compelling, clear, and conversion-focused.
Keep the tone professional but approachable. Be concise.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const userPrompt = wrapUntrustedContent('listing input', `Enhance this ${type || 'service'} listing:
Title: ${title || '(none provided)'}
Description: ${description || '(none provided)'}
Category: ${category || 'general'}

Return the result using the enhance_listing function.`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_3_FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "enhance_listing",
              description: "Return an enhanced title and description for a creative service listing.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Enhanced title, under 60 chars" },
                  description: { type: "string", description: "Enhanced description, 2-3 sentences" },
                },
                required: ["title", "description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "enhance_listing" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway response:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let result = { title: title || "", description: description || "" };
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        // Try extracting from content as fallback
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
          if (jsonMatch) {
            try { result = JSON.parse(jsonMatch[0]); } catch { /* keep original */ }
          }
        }
      }
    } else {
      // No tool call — try parsing content directly
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
        if (jsonMatch) {
          try { result = JSON.parse(jsonMatch[0]); } catch { /* keep original */ }
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return safeError(error, req);
  }
});
