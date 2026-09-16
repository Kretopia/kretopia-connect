import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, category } = await req.json();
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
        model: "google/gemini-3-flash-preview",
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

Articles should be 500-900 words. Write in markdown. Make every word count — no filler.`,
          },
          {
            role: "user",
            content: `Write a ${category || "inspiration"} article titled: "${title}".

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

    return new Response(JSON.stringify({ error: "Failed to generate" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-magazine-article error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
