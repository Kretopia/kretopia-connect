import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SocialStats {
  youtube_subscribers?: number;
  instagram_followers?: number;
  tiktok_followers?: number;
  spotify_listeners?: number;
  twitter_followers?: number;
  linkedin_connections?: number;
}

function parseFollowerCount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, "").trim().toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(m|k|b)?/);
  if (!match) return null;
  let num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "k") num *= 1000;
  else if (suffix === "m") num *= 1000000;
  else if (suffix === "b") num *= 1000000000;
  return Math.round(num);
}

async function scrapeWithFirecrawl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      waitFor: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.data?.markdown || "";
}

async function getYouTubeStats(url: string): Promise<number | null> {
  if (!YOUTUBE_API_KEY) return null;
  
  const handleMatch = url.match(/@([\w-]+)/);
  const channelIdMatch = url.match(/channel\/([\w-]+)/);
  
  let channelId = channelIdMatch?.[1];
  
  if (handleMatch && !channelId) {
    const searchResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${handleMatch[1]}&type=channel&key=${YOUTUBE_API_KEY}`
    );
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      channelId = searchData.items?.[0]?.snippet?.channelId;
    }
  }
  
  if (!channelId) return null;
  
  const resp = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  const subs = data.items?.[0]?.statistics?.subscriberCount;
  return subs ? parseInt(subs) : null;
}

function extractFollowersFromMarkdown(markdown: string, platform: string): number | null {
  const patterns: Record<string, RegExp[]> = {
    instagram: [
      /([\d,.]+[mkb]?)\s*(?:followers|Followers)/i,
      /followers[:\s]*([\d,.]+[mkb]?)/i,
    ],
    tiktok: [
      /([\d,.]+[mkb]?)\s*(?:followers|Followers)/i,
      /followers[:\s]*([\d,.]+[mkb]?)/i,
    ],
    twitter: [
      /([\d,.]+[mkb]?)\s*(?:followers|Followers|Following)/i,
      /followers[:\s]*([\d,.]+[mkb]?)/i,
    ],
    linkedin: [
      /([\d,.]+[mkb]?)\s*(?:connections|followers|Connections|Followers)/i,
    ],
    spotify: [
      /([\d,.]+[mkb]?)\s*(?:monthly listeners|listeners)/i,
    ],
    youtube: [
      /([\d,.]+[mkb]?)\s*(?:subscribers|Subscribers)/i,
    ],
  };

  const platformPatterns = patterns[platform] || [];
  for (const pattern of platformPatterns) {
    const match = markdown.match(pattern);
    if (match?.[1]) {
      const count = parseFollowerCount(match[1]);
      if (count && count > 0) return count;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("youtube_url, instagram_url, tiktok_url, spotify_url, twitter_url, linkedin_url, youtube_subscribers, instagram_followers, tiktok_followers, spotify_listeners, twitter_followers, linkedin_connections")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats: SocialStats = {};
    const results: Record<string, { source: string; value: number | null; error?: string }> = {};

    if (profile.youtube_url) {
      try {
        const apiResult = await getYouTubeStats(profile.youtube_url);
        if (apiResult) {
          stats.youtube_subscribers = apiResult;
          results.youtube = { source: "api", value: apiResult };
        } else {
          const md = await scrapeWithFirecrawl(profile.youtube_url);
          const scraped = extractFollowersFromMarkdown(md, "youtube");
          if (scraped) {
            stats.youtube_subscribers = scraped;
            results.youtube = { source: "scrape", value: scraped };
          } else {
            results.youtube = { source: "scrape", value: null, error: "Could not extract subscriber count" };
          }
        }
      } catch (e) {
        results.youtube = { source: "error", value: null, error: String(e) };
      }
    }

    const scrapeTargets = [
      { key: "instagram", url: profile.instagram_url, statKey: "instagram_followers" as keyof SocialStats },
      { key: "tiktok", url: profile.tiktok_url, statKey: "tiktok_followers" as keyof SocialStats },
      { key: "spotify", url: profile.spotify_url, statKey: "spotify_listeners" as keyof SocialStats },
      { key: "twitter", url: profile.twitter_url, statKey: "twitter_followers" as keyof SocialStats },
      { key: "linkedin", url: profile.linkedin_url, statKey: "linkedin_connections" as keyof SocialStats },
    ];

    for (const target of scrapeTargets) {
      if (!target.url) continue;
      try {
        const md = await scrapeWithFirecrawl(target.url);
        const count = extractFollowersFromMarkdown(md, target.key);
        if (count) {
          stats[target.statKey] = count;
          results[target.key] = { source: "scrape", value: count };
        } else {
          results[target.key] = { source: "scrape", value: null, error: "Could not extract count" };
        }
      } catch (e) {
        results[target.key] = { source: "error", value: null, error: String(e) };
      }
    }

    const updateData: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats)) {
      if (value != null && value > 0) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: updateData,
        details: results,
        updated: Object.keys(updateData).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("sync-social-stats error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
