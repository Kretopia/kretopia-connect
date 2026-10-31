import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_3_1_PRO } from "../_shared/aiModels.ts";
import { z } from "npm:zod@4";
import { corsFor, readJson, safeError } from "../_shared/guard.ts";
import { requireAiCaller } from "../_shared/aiPerimeter.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const BodySchema = z.object({
  rawText: z.string().trim().min(50).max(50000),
  images: z.array(z.url().refine(value => /^https?:\/\//i.test(value))).max(50).default([]),
  title: z.string().max(500).nullish(),
  category: z.string().max(100).nullish(),
});

/**
 * Magic Compose: Takes raw pasted article text + a list of image URLs and uses AI
 * to build a fully formatted magazine article — picks cover, places remaining
 * images in the body, extracts pull quotes, bolds key phrases, generates subtitle
 * and category. Does NOT invent prose; uses only the supplied text.
 */
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, "compose-magazine-article");
    const { rawText, images, title: hintTitle, category: hintCategory } = await readJson(req, BodySchema);
    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 50) {
      return new Response(JSON.stringify({ error: "rawText (article body) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imageList = (images as string[]).filter(u => typeof u === "string" && u.startsWith("http"));
    const imageManifest = imageList.length
      ? imageList.map((u, i) => `${i}: ${u}`).join("\n")
      : "(none provided)";

    const ALLOWED_CATEGORIES = [
      "fashion","art-culture","music","film","events-festivals","impact","community",
      "web3-ai","taste-of-bali","photography","business","lifestyle-wellness",
      "bali-developments","inspiration","how-to","spotlight",
    ];

    const systemPrompt = `You are the senior layout editor for ThriveIN Magazine. You take a raw article (often pasted from a Google Doc or PDF) and lay it out for premium publication — like Highsnobiety, The Verge, Wired, NYT Magazine.

ABSOLUTE RULES — VIOLATING ANY MEANS FAILED OUTPUT:
1. Use ONLY the words from the supplied article text. Do NOT invent new sentences, facts, or paraphrases.
2. You MAY split paragraphs, reorder consecutive sentences within a section, and add structural markdown (## subheadings, > blockquotes, **bold**, image placements).
3. You MAY add 2–4 short ## subheadings (3–6 words) — these are NEW text but must be drawn directly from nouns/phrases in the article.
4. NEVER drop information. Every sentence from the input must appear somewhere in the output (possibly broken into shorter paragraphs).
5. Preserve all names, brands, URLs, statistics, quoted material exactly.

LAYOUT REQUIREMENTS:
- Pick the strongest opening hook as the first paragraph.
- Add 2–4 ## subheadings between logical sections.
- Promote 1–2 of the most quotable sentences into > blockquote pull quotes (replace the inline occurrence — do not duplicate).
- **Bold** one short phrase (2–6 words) per major section for visual rhythm. Must be exact text from the paragraph.
- Insert markdown image references using EXACTLY this syntax: \`![](IMAGE_URL)\` placed on their own line between paragraphs (NOT inside them). Place body images at natural break points — after a paragraph that introduces a new theme, between a setup and payoff, or after a quote. Spread them evenly through the article. Do NOT cluster them.
- Pick the SINGLE best image for the COVER (return its index in coverIndex). The cover image must NOT also appear in the body.
- Use ALL provided body images at least once. If there are more images than reasonable break points, place extras at the end as a small gallery (each on its own line).

METADATA:
- Generate a punchy 1-line subtitle (max 120 chars) drawn from the article's themes.
- Choose category from this list ONLY: ${ALLOWED_CATEGORIES.join(", ")}.
- If a title hint is given, use it. Otherwise extract the most likely title from the first lines.

Return your output via the format_article tool. Output content must be markdown only.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const userPrompt = wrapUntrustedContent("article and layout hints", `Title hint: ${hintTitle || "(none — extract from text)"}
Category hint: ${hintCategory || "(none — pick best fit)"}

Available images (index: url):
${imageManifest}

Raw article text:
---
${rawText}
---

Lay this out as a premium magazine article. Use the available images. Pick the cover. Place body images between paragraphs. Add subheadings, pull quotes, and bold emphasis. Use only the words from the article.`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_3_1_PRO,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_article",
              description: "Return the laid-out magazine article",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Article title" },
                  subtitle: { type: "string", description: "Punchy one-line subtitle, max 120 chars" },
                  category: { type: "string", enum: ALLOWED_CATEGORIES, description: "Best-fit category" },
                  coverIndex: { type: "integer", description: "Index of the chosen cover image in the supplied images array, or -1 if none" },
                  content: { type: "string", description: "Full article in markdown with ## headings, > blockquotes, **bold**, and inline ![](url) image references between paragraphs" },
                },
                required: ["title", "subtitle", "category", "coverIndex", "content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "format_article" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — add credits in workspace settings" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return safeError(new Error("AI did not return a formatted article"), req);
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const coverIndex: number = typeof parsed.coverIndex === "number" ? parsed.coverIndex : -1;
    const coverImageUrl = coverIndex >= 0 && coverIndex < imageList.length ? imageList[coverIndex] : (imageList[0] || null);

    return new Response(JSON.stringify({
      title: parsed.title,
      subtitle: parsed.subtitle,
      category: parsed.category,
      coverImageUrl,
      content: parsed.content,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return safeError(e, req);
  }
});
