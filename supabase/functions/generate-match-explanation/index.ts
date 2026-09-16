import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentUser, targetUser } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Helper function to extract skills from Json type (can be array or object)
    const extractSkills = (skills: any): string[] => {
      if (!skills) return [];
      if (Array.isArray(skills)) return skills;
      if (typeof skills === 'object') return Object.keys(skills);
      return [];
    };

    const currentSkills = extractSkills(currentUser.professional_skills);
    const targetSkills = extractSkills(targetUser.professional_skills);

    console.log('[generate-match-explanation] Current user:', {
      name: currentUser.full_name,
      role: currentUser.role,
      skills: currentSkills,
      location: currentUser.location
    });
    console.log('[generate-match-explanation] Target user:', {
      name: targetUser.full_name,
      role: targetUser.role,
      skills: targetSkills,
      location: targetUser.location
    });

    const systemPrompt = `You are a professional matchmaking AI for creative collaborators. Analyze two creator profiles and generate a compatibility score with specific reasons.

CRITICAL: You MUST use the EXACT names, skills, locations, and bios provided in the user profiles. Do NOT make up information or use generic placeholders.

Your response must be a JSON object with this EXACT structure:
{
  "score": 85,
  "reasons": [
    "Complementary skills: Their videography fills your need for visual storytelling",
    "Super close by: Both in Brooklyn—easy to meet and work together",
    "Shared vision: Both focused on creative storytelling and building a portfolio"
  ]
}

Rules:
- Score must be 70-99 (high matches only)
- Include 3-4 specific, actionable reasons
- Use the ACTUAL user data provided (names, skills, locations, bios)
- Focus on: complementary skills, location proximity, shared interests, portfolio alignment
- Be concise and specific
- Use enthusiastic but professional tone`;

    const userPrompt = `Current User Profile:
Name: ${currentUser.full_name}
Role: ${currentUser.role || "Creative"}
Skills: ${currentSkills.join(", ") || "Not specified"}
Location: ${currentUser.location || "Not specified"}
Bio: ${currentUser.bio || "Not specified"}

Target User Profile:
Name: ${targetUser.full_name}
Role: ${targetUser.role || "Creative"}
Skills: ${targetSkills.join(", ") || "Not specified"}
Location: ${targetUser.location || "Not specified"}
Bio: ${targetUser.bio || "Not specified"}

IMPORTANT: Generate match reasons using the ACTUAL names, skills, and locations above. Do NOT use placeholder names or made-up information.

Analyze compatibility and generate match explanation.`;

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
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_match_score",
              description: "Generate a compatibility score and reasons for two creators",
              parameters: {
                type: "object",
                properties: {
                  score: {
                    type: "number",
                    description: "Compatibility score between 70-99"
                  },
                  reasons: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 specific reasons why they're compatible"
                  }
                },
                required: ["score", "reasons"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_match_score" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0].message.tool_calls?.[0];
    
    if (!toolCall || !toolCall.function) {
      throw new Error("No tool call returned from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        score: parsed.score,
        reasons: parsed.reasons
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-match-explanation:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        // Fallback match data
        score: 85,
        reasons: [
          "Complementary skills that align well",
          "Great potential for collaboration",
          "Similar creative interests",
          "Compatible work styles"
        ]
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
