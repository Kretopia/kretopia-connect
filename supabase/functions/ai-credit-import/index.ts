import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, content, userId } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: "No content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prompt = "";
    if (type === "link") {
      prompt = `Given this URL to a creative work: "${content}"
      
Extract the following information and return as JSON:
- project_name: The name/title of the project
- role: The most likely role the person had. If unclear, leave empty.
- project_type: One of: film, tv, short_film, documentary, music_video, web_series, album, single, ep, podcast, audiobook, theatre, musical, dance, comedy, spoken_word, opera, live_event, concert, festival, carnival, pageant, fashion_show, awards_show, exhibition, conference, youtube_series, ugc_campaign, livestream, online_course, workshop, commercial, brand_campaign, corporate, voiceover, influencer_campaign, art_exhibition, mural, graphic_design, photography, animation, fashion_collection, editorial_shoot, runway, beauty_campaign, styling, talent_management, booking, label_release, publishing, curation, tour, choreography, backup_dancer, dj_set, mc_hosting, soca, dancehall, afrobeats, gospel_concert
- year: Year if detectable, otherwise null
- platform: Platform name if detectable (YouTube, Spotify, IMDb, Netflix, etc.)
- description: Brief one-line description if detectable

Return ONLY valid JSON.`;
    } else {
      prompt = `A creative professional described a project or uploaded a file named: "${content}"
      
Extract/structure this into a credit entry. Return as JSON:
- project_name: A clean, professional project name
- role: Their specific role on this project (if detectable from filename/context)
- project_type: One of: film, tv, short_film, documentary, music_video, web_series, album, single, ep, podcast, audiobook, theatre, musical, dance, comedy, spoken_word, opera, live_event, concert, festival, carnival, pageant, fashion_show, awards_show, exhibition, conference, youtube_series, ugc_campaign, livestream, online_course, workshop, commercial, brand_campaign, corporate, voiceover, influencer_campaign, art_exhibition, mural, graphic_design, photography, animation, fashion_collection, editorial_shoot, runway, beauty_campaign, styling, talent_management, booking, label_release, publishing, curation, tour, choreography, backup_dancer, dj_set, mc_hosting
- year: Year if detectable, otherwise null
- platform: Platform if detectable, otherwise null
- description: Brief description if detectable, otherwise null

Return ONLY valid JSON.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You extract creative project credits from descriptions, URLs, or filenames. Cover the FULL creative and content industry: film, TV, music, theatre, dance, fashion, events, concerts, tours, carnival, pageants, podcasts, digital content, commercial work, art, photography, and more. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    return new Response(JSON.stringify({
      project_name: parsed.project_name || "",
      role: parsed.role || "",
      project_type: parsed.project_type || "",
      year: parsed.year || null,
      platform: parsed.platform || null,
      description: parsed.description || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
