import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profile, credits, services, endorsements, reviews } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const creditsSummary = (credits || []).slice(0, 20).map((c: any) =>
      `${c.project_name} (${c.role}${c.year ? `, ${c.year}` : ''}${c.credit_category ? `, ${c.credit_category}` : ''})`
    ).join("; ");

    const servicesSummary = (services || []).map((s: any) =>
      `${s.title}${s.category ? ` [${s.category}]` : ''}`
    ).join("; ");

    const endorsementCount = (endorsements || []).length;
    const reviewCount = (reviews || []).length;
    const avgRating = reviewCount > 0
      ? ((reviews || []).reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviewCount).toFixed(1)
      : null;

    const hasVisualCredits = (credits || []).some((c: any) => c.thumbnail_url || c.primary_media_url);
    const creditCategories = [...new Set((credits || []).map((c: any) => c.credit_category).filter(Boolean))];

    const systemPrompt = `You are a professional website copywriter and creative director for Kretopia, a platform for creative professionals. Your job is to analyze a creator's profile data and generate optimized website content.

You must respond with a JSON object using the tool provided. Be bold, professional, and compelling. Avoid generic AI-sounding copy. Write like a top-tier creative agency.`;

    const userPrompt = `Analyze this creator's profile and generate their website content:

**Name:** ${profile.full_name || 'Unknown'}
**Current Role:** ${profile.role || 'Creative Professional'}
**Current Bio:** ${profile.bio || 'No bio provided'}
**Location:** ${profile.location || 'Not specified'}
**Credits (${(credits || []).length} total):** ${creditsSummary || 'None'}
**Credit Categories:** ${creditCategories.join(', ') || 'None'}
**Services (${(services || []).length}):** ${servicesSummary || 'None'}
**Endorsements:** ${endorsementCount}
**Reviews:** ${reviewCount}${avgRating ? ` (avg ${avgRating}★)` : ''}
**Has Visual Portfolio:** ${hasVisualCredits ? 'Yes' : 'No'}
**Social Links:** ${[profile.instagram_url && 'Instagram', profile.linkedin_url && 'LinkedIn', profile.youtube_url && 'YouTube', profile.spotify_url && 'Spotify', profile.twitter_url && 'Twitter'].filter(Boolean).join(', ') || 'None'}

Generate optimized website content for this creator. The headline should be punchy and professional (not generic). The bio should be compelling and written in third person. The template should match their industry and visual assets.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_website",
              description: "Generate optimized website content for a creator",
              parameters: {
                type: "object",
                properties: {
                  headline: {
                    type: "string",
                    description: "A punchy, professional headline (max 60 chars). Not generic. Captures their unique value."
                  },
                  bio: {
                    type: "string",
                    description: "A compelling 2-3 sentence bio written in third person. Professional but human."
                  },
                  template: {
                    type: "string",
                    enum: ["bold-electric", "minimal-editorial", "portfolio-mosaic", "creative-director", "artist-showcase", "producer", "agency", "minimal-clean", "photographer"],
                    description: "Best template for this creator based on their industry, visual assets, and professional level."
                  },
                  template_reason: {
                    type: "string",
                    description: "Brief reason why this template was chosen (1 sentence)."
                  },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", enum: ["hero", "services", "credits", "testimonials", "contact"] },
                        label: { type: "string" },
                        visible: { type: "boolean" }
                      },
                      required: ["id", "label", "visible"]
                    },
                    description: "Ordered sections. Hide sections with no data. Order by importance for this creator."
                  }
                },
                required: ["headline", "bio", "template", "template_reason", "sections"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_website" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    
    // Extract tool call arguments
    let generated;
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === 'string' 
        ? toolCall.function.arguments 
        : JSON.stringify(toolCall.function.arguments);
      
      if (args && args !== '{}') {
        generated = JSON.parse(args);
      }
    }
    
    // Fallback: try to extract from message content
    if (!generated) {
      const content = result.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generated = JSON.parse(jsonMatch[0]);
      }
    }

    if (!generated) {
      return new Response(JSON.stringify({ error: "Failed to generate website content" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(generated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-site error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
