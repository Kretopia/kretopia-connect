import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { TOKENS_SHORT_DRAFT } from "../_shared/aiLimits.ts";

const BodySchema = z.object({
  title: z.string().trim().min(3).max(1000),
  category: z.string().max(255).nullish(),
  gigType: z.string().max(255).nullish(),
  location: z.string().max(1000).nullish(),
});

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, 'generate-gig-description');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { title, category, gigType, location } = await readJson(req, BodySchema);

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return new Response(JSON.stringify({ error: "A title of at least 3 characters is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = wrapUntrustedContent('gig input', `Title: ${title.trim()}
${category ? `Category: ${category}` : ""}
${gigType ? `Type: ${gigType}` : ""}
${location ? `Location: ${location}` : ""}`);
    const systemPrompt = `You are a creative industry copywriter. Write a compelling, professional gig description (3-5 sentences) for the supplied listing.
Keep it concise, professional, and appealing to creative freelancers. Include what the role involves and what makes it exciting. Do NOT include compensation details or application instructions. Return ONLY the description text, no quotes or labels.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_3_FLASH,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        max_tokens: TOKENS_SHORT_DRAFT,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI request failed: ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const description = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return safeError(e, req);
  }
});
