import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { z } from "npm:zod@4";
import { corsFor, readJson, safeError } from "../_shared/guard.ts";
import { requireAiCaller } from "../_shared/aiPerimeter.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const BodySchema = z.object({ title: z.string().trim().min(1).max(500), category: z.string().max(100).nullish() });

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, "generate-magazine-article");
    const { title, category } = await readJson(req, BodySchema);
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_3_FLASH,
        messages: [
          {
            role: "system",
            content: `You are the lead writer for ThriveIN Magazine — a premium publication for creative professionals, content creators, musicians, filmmakers, designers, and entrepreneurs in the creator economy.

Your writing style:
- Confident, modern, and culturally aware
- Mix storytelling with practical insights
- Reference real trends, tools, and platforms creators actually use
- Include specific, actionable takeaways
- Write with the authority of someone embedded in the creative industry

Structure every article with:
1. A compelling hook/intro paragraph that draws the reader in
2. Well-organized sections with clear subheadings (use ##)
3. At least one pull quote (using > blockquote syntax) that captures a key insight
4. Practical tips, strategies, or steps the reader can apply immediately
5. A strong closing that inspires action

Articles should be 500-900 words. Write in markdown. Make every word count — no filler.${PROMPT_INJECTION_DEFENSE_CLAUSE}`,
          },
          {
            role: "user",
            content: `Article brief: ${wrapUntrustedContent("article title and category", JSON.stringify({ title, category: category || "inspiration" }))}

Requirements:
- A compelling one-sentence subtitle
- The full article in markdown with ## subheadings, > blockquotes, and **bold** emphasis
- Include 2-3 specific, actionable takeaways
- Reference real tools, platforms, or trends where relevant
- End with a call to action or inspiring closer`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "write_article",
              description: "Return the generated magazine article",
              parameters: {
                type: "object",
                properties: {
                  subtitle: { type: "string", description: "A compelling one-line subtitle" },
                  content: { type: "string", description: "The full article in markdown format with ## headings, > blockquotes, and rich formatting" },
                },
                required: ["subtitle", "content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "write_article" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return safeError(new Error("Failed to generate"), req);
  } catch (e) {
    return safeError(e, req);
  }
});
