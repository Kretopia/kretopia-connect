import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/require-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscoveredProfile {
  name: string;
  role: string;
  bio?: string;
  location?: string;
  sourceUrl: string;
  skills?: string[];
  imageUrl?: string;
  confidence: number;
  credits?: Array<{ project: string; role: string; year?: number }>;
  awards?: Array<{ title: string; organization: string; year?: number }>;
  pressLinks?: Array<{ title: string; url: string; source: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.response;

    const { name, platformUrl } = await req.json();
    console.log("=== ONBOARDING DISCOVERY ===");
    console.log("Name:", name);
    console.log("Platform URL:", platformUrl);

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Web search not configured", profiles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured", profiles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discoveredProfiles: DiscoveredProfile[] = [];

    // Strategy 1: If platform URL provided, scrape it directly
    if (platformUrl) {
      console.log("Scraping platform URL:", platformUrl);
      const profile = await scrapeProfileUrl(platformUrl, name, FIRECRAWL_API_KEY, LOVABLE_API_KEY);
      if (profile) {
        discoveredProfiles.push(profile);
      }
    }

    // Strategy 2: Search by name across multiple platforms
    if (name) {
      console.log("Searching for name:", name);
      
      // Build search queries for different platforms
      const searchQueries = [
        `"${name}" site:imdb.com/name`,
        `"${name}" site:open.spotify.com/artist`,
        `"${name}" site:discogs.com/artist`,
        `"${name}" site:soundcloud.com`,
        `"${name}" site:behance.net`,
        `"${name}" site:dribbble.com`,
        `"${name}" musician OR producer OR artist OR director OR filmmaker OR designer`,
      ];

      // Run searches in parallel (limit to 4 for speed)
      const searchPromises = searchQueries.slice(0, 4).map(async (query) => {
        try {
          console.log("Searching:", query);
          const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              limit: 5,
              scrapeOptions: { formats: ["markdown"] },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            return data.data || [];
          }
          return [];
        } catch (e) {
          console.error("Search error:", e);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      const flatResults = allResults.flat();
      console.log("Total search results:", flatResults.length);

      // Deduplicate by URL
      const uniqueUrls = new Map();
      for (const result of flatResults) {
        if (result.url && !uniqueUrls.has(result.url)) {
          uniqueUrls.set(result.url, result);
        }
      }
      const uniqueResults = Array.from(uniqueUrls.values());
      console.log("Unique results:", uniqueResults.length);

      // Extract profiles in parallel (limit to best 8)
      const extractionPromises = uniqueResults.slice(0, 8).map(async (result: any) => {
        // Skip LinkedIn and irrelevant sites
        if (result.url?.includes('linkedin.com')) return null;
        if (result.url?.includes('facebook.com')) return null;
        if (result.url?.includes('twitter.com')) return null;
        
        const content = result.markdown || result.description || result.title || '';
        if (!content || content.length < 50) return null;

        return extractProfileWithAI(content, result.url, name, LOVABLE_API_KEY);
      });

      const extractedProfiles = await Promise.all(extractionPromises);
      discoveredProfiles.push(...extractedProfiles.filter((p): p is DiscoveredProfile => p !== null));
    }

    // Deduplicate by name
    const uniqueProfiles = deduplicateProfiles(discoveredProfiles);
    
    // Sort by confidence
    uniqueProfiles.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    console.log(`=== RESULT: ${uniqueProfiles.length} profiles ===`);

    return new Response(
      JSON.stringify({
        success: true,
        profiles: uniqueProfiles.slice(0, 5), // Return top 5
        count: uniqueProfiles.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in onboarding-discover:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Discovery failed",
        success: false,
        profiles: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function scrapeProfileUrl(
  url: string,
  expectedName: string,
  firecrawlKey: string,
  lovableKey: string
): Promise<DiscoveredProfile | null> {
  try {
    console.log("Scraping URL:", url);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error("Scrape failed:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || "";
    
    if (!content || content.length < 100) {
      console.log("Insufficient content from URL");
      return null;
    }

    return extractProfileWithAI(content, url, expectedName, lovableKey);
  } catch (e) {
    console.error("Scrape error:", e);
    return null;
  }
}

async function extractProfileWithAI(
  content: string,
  sourceUrl: string,
  searchHint: string,
  apiKey: string
): Promise<DiscoveredProfile | null> {
  try {
    if (!content || content.length < 50) return null;

    console.log("AI extracting from:", sourceUrl.substring(0, 60));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You extract comprehensive professional profile data from web content for onboarding.
Focus on: musicians, producers, filmmakers, designers, artists, content creators.
The user is: "${searchHint}" - prioritize data matching this name.
Extract ALL credits, awards, and achievements you can find.`
          },
          {
            role: "user",
            content: `Extract complete professional profile for "${searchHint}" from:\n\n${content.substring(0, 20000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract comprehensive professional profile",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name" },
                  role: { type: "string", description: "Primary professional role" },
                  bio: { type: "string", description: "Professional bio (max 500 chars)" },
                  location: { type: "string", description: "Location if mentioned" },
                  skills: { 
                    type: "array", 
                    items: { type: "string" }, 
                    description: "Professional skills (max 10)" 
                  },
                  imageUrl: { type: "string", description: "Profile image URL" },
                  credits: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project: { type: "string" },
                        role: { type: "string" },
                        year: { type: "number" }
                      }
                    },
                    description: "Professional credits (films, albums, projects)"
                  },
                  awards: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        organization: { type: "string" },
                        year: { type: "number" }
                      }
                    },
                    description: "Awards and nominations"
                  },
                  isValidProfile: { type: "boolean", description: "True if valid creator profile" },
                  confidence: { type: "number", description: "Confidence 0-100 this matches the searched person" }
                },
                required: ["name", "role", "isValidProfile", "confidence"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } }
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return null;
    }

    if (!extracted.isValidProfile || !extracted.name || extracted.name.length < 2) {
      return null;
    }

    // Boost confidence if name matches closely
    let confidence = extracted.confidence || 50;
    if (extracted.name.toLowerCase().includes(searchHint.toLowerCase()) ||
        searchHint.toLowerCase().includes(extracted.name.toLowerCase())) {
      confidence = Math.min(100, confidence + 20);
    }

    console.log("✓ Extracted:", extracted.name, "confidence:", confidence);
    
    return {
      name: extracted.name,
      role: extracted.role || "Creator",
      bio: extracted.bio,
      location: extracted.location,
      sourceUrl,
      skills: extracted.skills?.slice(0, 10),
      imageUrl: extracted.imageUrl,
      confidence,
      credits: extracted.credits?.slice(0, 20),
      awards: extracted.awards?.slice(0, 10),
    };
  } catch (e) {
    console.error("Extraction error:", e);
    return null;
  }
}

function deduplicateProfiles(profiles: DiscoveredProfile[]): DiscoveredProfile[] {
  const seen = new Map<string, DiscoveredProfile>();
  
  for (const profile of profiles) {
    const key = profile.name.toLowerCase().trim();
    const existing = seen.get(key);
    
    // Keep the one with higher confidence or more data
    if (!existing || (profile.confidence || 0) > (existing.confidence || 0)) {
      seen.set(key, profile);
    } else if (existing && profile.credits && profile.credits.length > (existing.credits?.length || 0)) {
      // Merge credits from both
      existing.credits = [...(existing.credits || []), ...profile.credits];
    }
  }
  
  return Array.from(seen.values());
}
