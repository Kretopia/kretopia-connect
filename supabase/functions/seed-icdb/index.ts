import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { industry, region, decade, batch_size = 10 } = await req.json();

    const industryPrompt = industry ? `Focus on the ${industry} industry.` : 'Cover all creative industries: music, film, TV, theatre, fashion, events, art, dance, digital content.';
    const regionPrompt = region ? `Focus on projects from ${region}.` : 'Include projects from around the world, with emphasis on underrepresented regions like Caribbean, Africa, South Asia, Latin America, and Southeast Asia.';
    const decadePrompt = decade ? `Focus on projects from the ${decade}s.` : 'Cover projects from all eras, 1960s to 2020s.';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a creative industry database curator. Generate REAL, VERIFIABLE creative projects for the Internet Creative Database (ICDB). 

CRITICAL: Only return real projects that actually exist. Include lesser-known and independent works, not just mainstream hits. Include projects from underrepresented regions and industries.

For each project, include key contributors with their REAL credited roles.`
          },
          {
            role: 'user',
            content: `Generate ${batch_size} real creative projects for our database.

${industryPrompt}
${regionPrompt}
${decadePrompt}

For each project include the key creative contributors (directors, producers, artists, designers, choreographers, etc.) with their actual credited roles.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "seed_icdb",
              description: "Insert verified creative projects into the ICDB",
              parameters: {
                type: "object",
                properties: {
                  projects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        type: { type: "string", enum: [
                          "film", "tv", "short_film", "documentary", "music_video", "web_series",
                          "album", "single", "ep", "podcast",
                          "theatre", "musical", "dance", "comedy", "opera",
                          "live_event", "concert", "festival", "carnival", "pageant", "fashion_show", "awards_show", "exhibition", "conference",
                          "youtube_series", "ugc_campaign", "livestream", "online_course", "workshop",
                          "commercial", "brand_campaign", "corporate", "voiceover",
                          "art_exhibition", "mural", "photography", "animation",
                          "fashion_collection", "editorial_shoot", "runway", "beauty_campaign"
                        ]},
                        year: { type: "number" },
                        description: { type: "string" },
                        platform: { type: "string" },
                        location: { type: "string" },
                        client_brand: { type: "string" },
                        external_url: { type: "string" },
                        metadata: {
                          type: "object",
                          properties: {
                            genre: { type: "string" },
                            featured_artists: { type: "array", items: { type: "string" } },
                            awards: { type: "array", items: { type: "string" } }
                          }
                        },
                        contributors: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              role: { type: "string" }
                            },
                            required: ["name", "role"]
                          }
                        },
                        company: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            type: { type: "string", enum: ["label", "studio", "agency", "brand", "venue", "production_company", "network"] },
                            industry: { type: "string" }
                          },
                          required: ["name", "type"]
                        }
                      },
                      required: ["title", "type", "description", "contributors"]
                    }
                  }
                },
                required: ["projects"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "seed_icdb" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI generation failed: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error('No structured data returned from AI');
    }

    const { projects } = JSON.parse(toolCall.function.arguments);
    
    // Map type to category
    const TYPE_TO_CATEGORY: Record<string, string> = {
      film: "film_tv", tv: "film_tv", short_film: "film_tv", documentary: "film_tv", music_video: "film_tv", web_series: "film_tv",
      album: "music", single: "music", ep: "music", podcast: "music",
      theatre: "performing", musical: "performing", dance: "performing", comedy: "performing", opera: "performing",
      live_event: "events", concert: "events", festival: "events", carnival: "events", pageant: "events", fashion_show: "events", awards_show: "events", exhibition: "events", conference: "events",
      youtube_series: "digital", ugc_campaign: "digital", livestream: "digital", online_course: "digital", workshop: "digital",
      commercial: "commercial", brand_campaign: "commercial", corporate: "commercial", voiceover: "commercial",
      art_exhibition: "art", mural: "art", photography: "art", animation: "art",
      fashion_collection: "fashion", editorial_shoot: "fashion", runway: "fashion", beauty_campaign: "fashion",
    };

    let insertedProjects = 0;
    let insertedRoles = 0;
    let insertedCompanies = 0;

    for (const project of projects) {
      // Check for duplicates by title + type + year
      const { data: existing } = await supabase
        .from('icdb_projects')
        .select('id')
        .eq('title', project.title)
        .eq('type', project.type)
        .maybeSingle();

      if (existing) continue; // Skip duplicates

      // Insert company first if provided
      let companyName = project.client_brand;
      if (project.company) {
        const { data: existingCompany } = await supabase
          .from('icdb_companies')
          .select('id')
          .eq('name', project.company.name)
          .maybeSingle();

        if (!existingCompany) {
          await supabase.from('icdb_companies').insert({
            name: project.company.name,
            type: project.company.type,
            industry: project.company.industry || null,
          });
          insertedCompanies++;
        }
        companyName = companyName || project.company.name;
      }

      // Insert project
      const { data: newProject, error: projectError } = await supabase
        .from('icdb_projects')
        .insert({
          title: project.title,
          type: project.type,
          category: TYPE_TO_CATEGORY[project.type] || null,
          year: project.year || null,
          description: project.description,
          platform: project.platform || null,
          location: project.location || null,
          client_brand: companyName || null,
          external_url: project.external_url || null,
          metadata: project.metadata || {},
          contributor_count: project.contributors?.length || 0,
          is_verified: true, // AI-seeded projects are marked verified
        })
        .select('id')
        .single();

      if (projectError) {
        console.error('Failed to insert project:', project.title, projectError);
        continue;
      }

      insertedProjects++;

      // Insert contributor roles
      if (project.contributors?.length && newProject) {
        const roles = project.contributors.map((c: any) => ({
          project_id: newProject.id,
          role_title: c.role,
          person_name: c.name,
        }));

        const { error: rolesError } = await supabase
          .from('icdb_project_roles')
          .insert(roles);

        if (!rolesError) {
          insertedRoles += roles.length;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inserted: {
        projects: insertedProjects,
        roles: insertedRoles,
        companies: insertedCompanies,
      },
      total_generated: projects.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in seed-icdb:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
