import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin/cron only: AI-powered bulk seed of public locations is privileged
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const { city, latitude, longitude, radius_km = 25 } = await req.json();
    if (!city || !latitude || !longitude) {
      return new Response(JSON.stringify({ error: "city, latitude, longitude required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = guard.userId; // null when invoked via cron

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate 25 realistic creative industry locations near ${city} (lat: ${latitude}, lng: ${longitude}, within ${radius_km}km). 
    
For each location, provide realistic data that a creative professional would find useful. Include a diverse mix of:
- Recording studios, photo studios, podcast studios
- Creative coworking spaces, maker spaces
- Shoot spots (mural walls, rooftops, scenic urban locations)
- Music stores, art supply stores
- Equipment rental houses
- Venues (galleries, performance spaces)

Each location must have coordinates within ${radius_km}km of the center point. Make the names, addresses, and descriptions realistic for ${city}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a creative industry location database specialist. Generate realistic location data." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "seed_locations",
            description: "Insert creative industry locations into the atlas",
            parameters: {
              type: "object",
              properties: {
                locations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string", description: "2-3 sentence description of the space" },
                      location_type: { type: "string", enum: ["studio", "creative_space", "shoot_spot", "venue", "music_store", "art_supply", "rental_house", "photo_lab"] },
                      category: { type: "string", description: "Subcategory like Recording Studio, Mural Wall, etc." },
                      address: { type: "string" },
                      city: { type: "string" },
                      latitude: { type: "number" },
                      longitude: { type: "number" },
                      amenities: { type: "array", items: { type: "string" }, description: "e.g. WiFi, Parking, AC, Sound System" },
                      tags: { type: "array", items: { type: "string" } },
                      is_rentable: { type: "boolean" },
                      price_per_hour: { type: "number", description: "Hourly rate in USD if rentable, null otherwise" },
                      hours_of_operation: {
                        type: "object",
                        properties: {
                          mon: { type: "string" }, tue: { type: "string" }, wed: { type: "string" },
                          thu: { type: "string" }, fri: { type: "string" }, sat: { type: "string" }, sun: { type: "string" }
                        }
                      }
                    },
                    required: ["name", "description", "location_type", "address", "city", "latitude", "longitude"]
                  }
                }
              },
              required: ["locations"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "seed_locations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const { locations } = JSON.parse(toolCall.function.arguments);
    if (!locations?.length) throw new Error("No locations generated");

    // Use service role to insert
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const insertData = locations.map((loc: any) => ({
      user_id: userId,
      name: loc.name,
      description: loc.description,
      location_type: loc.location_type || "creative_space",
      category: loc.category || null,
      address: loc.address,
      city: loc.city || city,
      latitude: loc.latitude,
      longitude: loc.longitude,
      amenities: loc.amenities || [],
      tags: loc.tags || [],
      is_rentable: loc.is_rentable || false,
      price_per_hour: loc.price_per_hour || null,
      hours_of_operation: loc.hours_of_operation || null,
      is_active: true,
    }));

    const { data: inserted, error: insertError } = await adminSupabase
      .from("creative_locations")
      .insert(insertData)
      .select("id, name, location_type");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save locations");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: inserted?.length || 0,
      locations: inserted 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("seed-atlas-locations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
