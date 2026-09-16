import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Reformats an existing article without changing the words.
 * - Adds ## subheadings between logical sections
 * - Bolds key phrases (max ~1 per paragraph)
 * - Promotes the strongest line(s) into > pull quotes
 * - Improves paragraph spacing
 * The output text content (when stripped of markdown) must remain semantically
 * identical to the input. We do NOT add or remove sentences.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, title, subtitle } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a senior magazine copy editor for ThriveIN Magazine.
Your job is to TYPOGRAPHICALLY POLISH an article so it reads like a top-tier publication (The Verge, Wired, NYT Magazine, Highsnobiety) WITHOUT rewriting it.

ABSOLUTE RULES — VIOLATING ANY MEANS A FAILED EDIT:
1. NEVER add new sentences or paragraphs. Every word in the output must come from the input.
2. NEVER remove information. You may split or merge paragraphs but the prose content remains intact.
3. NEVER change facts, names, brands, URLs, statistics, or quoted material.
4. NEVER paraphrase or "improve" wording. Same words. Same order (mostly).
5. You MAY break a long paragraph into shorter ones for breathability.
6. You MAY reorder consecutive sentences only if both belong to the same idea — prefer not to.

WHAT YOU MUST DO:
- Add 2–4 ## subheadings (3–6 words each) using strong nouns or hooks pulled from the article's own language. Subheadings ARE new text — keep them short, punchy, sentence-style.
- Promote 1–2 sentences that are quotable insights into > blockquotes (pull quotes). These sentences must already exist verbatim in the prose; bracket them with > and a blank line above and below. Do NOT duplicate them — replace the inline occurrence with the blockquote.
- **Bold** 1 short phrase (2–6 words) per major paragraph for emphasis — must be exact text from the paragraph.
- Add blank lines between paragraphs and around blockquotes/headings for breathability.
- If the article has bullet-able items written as run-on lists ("first…, second…, third…"), you may convert to a markdown list using the original wording.
- Preserve all existing markdown images, links, and embeds exactly.

OUTPUT MARKDOWN ONLY. No preamble, no explanation.`;

    const userPrompt = `Title: ${title || "(untitled)"}
${subtitle ? `Subtitle: ${subtitle}` : ""}

Polish this article:

---
${content}
---

Return the polished markdown only.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add credits in workspace settings" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const polished = data.choices?.[0]?.message?.content?.trim();
    if (!polished) {
      return new Response(JSON.stringify({ error: "Empty response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content: polished }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish-magazine-article error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
