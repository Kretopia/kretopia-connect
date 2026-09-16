import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Extract Spotify ID + type
function extractSpotifyInfo(url: string): { type: string; id: string } | null {
  const m = url.match(/open\.spotify\.com\/(album|track|episode|show)\/([a-zA-Z0-9]+)/);
  if (m) return { type: m[1], id: m[2] };
  return null;
}

// Keyword-based category inference
function inferCategory(credit: any): string | null {
  const name = (credit.project_name || "").toLowerCase();
  const role = (credit.role || "").toLowerCase();
  const src = (credit.source || "").toLowerCase();
  const plat = (credit.platform || "").toLowerCase();
  const url = (credit.url || credit.primary_media_url || "").toLowerCase();

  // Source-based
  if (["tmdb", "imdb"].includes(src)) return "film";
  if (["spotify", "musicbrainz", "discogs", "soundcloud"].includes(src)) {
    if (credit.credit_category === "podcast" || role.includes("host") || name.includes("podcast") || name.includes("talks")) return "podcast";
    return "album";
  }
  if (src.includes("youtube") || url.includes("youtube.com") || url.includes("youtu.be")) return "music_video";
  if (src.includes("vimeo") || url.includes("vimeo.com")) return "film";

  // Platform field often contains the real type (e.g., "Film", "Netflix", "TV Series", "Album")
  if (plat.includes("film") || plat.includes("feature") || plat.includes("independent") || plat.includes("short")) return "film";
  if (plat.includes("netflix") || plat.includes("hulu") || plat.includes("amazon") || plat.includes("disney") || plat.includes("hbo") || plat.includes("apple tv")) return "tv";
  if (plat.includes("tv") || plat.includes("television") || plat.includes("oxygen") || plat.includes("lifetime") || plat.includes("abc") || plat.includes("nbc") || plat.includes("cbs") || plat.includes("fox")) return "tv";
  if (plat.includes("documentary")) return "documentary";
  if (plat.includes("album") || plat.includes("music album")) return "album";
  if (plat.includes("music") || plat.includes("single")) return "single";
  if (plat.includes("podcast")) return "podcast";
  if (plat.includes("commercial") || plat.includes("ad")) return "commercial";
  if (plat.includes("theater") || plat.includes("theatre") || plat.includes("stage") || plat.includes("broadway")) return "theatre";

  // Role-based
  if (role.includes("actor") || role.includes("actress") || role.includes("casting") || role.includes("director") || role.includes("producer") || role.includes("writer") || role.includes("cinematograph")) return "film";
  if (role.includes("host") || role.includes("podcast")) return "podcast";
  if (role.includes("dj")) return "dj_set";
  if (role.includes("photographer")) return "photography";
  if (role.includes("model") || role.includes("stylist")) return "editorial_shoot";
  if (role.includes("dancer") || role.includes("choreograph")) return "dance";
  if (role.includes("musician") || role.includes("singer") || role.includes("rapper") || role.includes("vocalist")) return "album";
  if (role.includes("editor") || role.includes("colorist") || role.includes("sound design") || role.includes("gaffer") || role.includes("grip") || role.includes("art director")) return "film";

  // Name-based
  if (name.includes("promo") || name.includes("event") || name.includes("festival") || name.includes("after movie") || name.includes("aftermovie")) return "live_event";
  if (name.includes("concert") || name.includes("tour")) return "concert";
  if (name.includes("carnival") || name.includes("mas ")) return "carnival";
  if (name.includes("fashion") || name.includes("runway")) return "fashion_show";
  if (name.includes("show") && (role.includes("actor") || role.includes("guest"))) return "tv";
  if (name.includes("album") || name.includes("ep ") || name.includes("single")) return "album";
  if (name.includes("film") || name.includes("movie") || name.includes("documentary")) return "film";
  if (name.includes("season") || name.includes("episode")) return "tv";
  if (name.includes("music video")) return "music_video";

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, batch_size = 50 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch credits that need enrichment
    let query = supabase
      .from("credits")
      .select("id, project_name, role, url, primary_media_url, thumbnail_url, credit_category, project_type, platform, source, media_type")
      .or("thumbnail_url.is.null,credit_category.is.null,credit_category.eq.,credit_category.eq.Other,credit_category.eq.general")
      .limit(batch_size);

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: credits, error } = await query;
    if (error) throw error;
    if (!credits || credits.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No credits to enrich", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${credits.length} credits for enrichment`);

    let updated = 0;
    let errors = 0;

    for (const credit of credits) {
      try {
        const updates: Record<string, any> = {};
        const mediaUrl = credit.url || credit.primary_media_url || "";

        // === THUMBNAIL EXTRACTION ===
        if (!credit.thumbnail_url) {
          // YouTube → direct thumbnail
          const ytId = extractYouTubeId(mediaUrl);
          if (ytId) {
            updates.thumbnail_url = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
          }

          // Spotify → use oEmbed API (no auth needed)
          if (!updates.thumbnail_url) {
            const spotifyInfo = extractSpotifyInfo(mediaUrl);
            if (spotifyInfo) {
              try {
                const oembedRes = await fetch(
                  `https://open.spotify.com/oembed?url=${encodeURIComponent(mediaUrl)}`
                );
                if (oembedRes.ok) {
                  const oembed = await oembedRes.json();
                  if (oembed.thumbnail_url) {
                    updates.thumbnail_url = oembed.thumbnail_url;
                  }
                }
              } catch (e) {
                console.log(`Spotify oEmbed failed for ${credit.id}:`, e);
              }
            }
          }

          // Vimeo → oEmbed
          if (!updates.thumbnail_url && mediaUrl.includes("vimeo.com")) {
            try {
              const vimeoRes = await fetch(
                `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(mediaUrl)}`
              );
              if (vimeoRes.ok) {
                const vimeo = await vimeoRes.json();
                if (vimeo.thumbnail_url) {
                  updates.thumbnail_url = vimeo.thumbnail_url;
                }
              }
            } catch (e) {
              console.log(`Vimeo oEmbed failed for ${credit.id}:`, e);
            }
          }

          // TMDB source → fetch poster using Firecrawl to scrape TMDB search page
          if (!updates.thumbnail_url && credit.source === "tmdb" && credit.project_name && firecrawlKey) {
            try {
              const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(credit.project_name)}`;
              const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${firecrawlKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: searchUrl,
                  formats: ["links"],
                  onlyMainContent: true,
                }),
              });
              if (scrapeRes.ok) {
                const scrapeData = await scrapeRes.json();
                const metadata = scrapeData.data?.metadata;
                if (metadata?.ogImage) {
                  updates.thumbnail_url = metadata.ogImage;
                } else if (metadata?.image) {
                  updates.thumbnail_url = metadata.image;
                }
                console.log(`TMDB scrape for "${credit.project_name}":`, metadata?.ogImage || 'no image');
              }
            } catch (e) {
              console.log(`TMDB scrape failed for ${credit.id}:`, e);
            }
          }

          // Firecrawl fallback for other URLs with content
          if (!updates.thumbnail_url && mediaUrl && firecrawlKey && !mediaUrl.includes("spotify.com") && !mediaUrl.includes("youtube.com")) {
            try {
              const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${firecrawlKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: mediaUrl,
                  formats: ["links"],
                  onlyMainContent: true,
                  waitFor: 2000,
                }),
              });
              if (scrapeRes.ok) {
                const scrapeData = await scrapeRes.json();
                const metadata = scrapeData.data?.metadata;
                // Try og:image from metadata
                if (metadata?.ogImage) {
                  updates.thumbnail_url = metadata.ogImage;
                } else if (metadata?.image) {
                  updates.thumbnail_url = metadata.image;
                }
              }
            } catch (e) {
              console.log(`Firecrawl failed for ${credit.id}:`, e);
            }
          }
        }

        // === CATEGORY INFERENCE ===
        const currentCat = credit.credit_category;
        if (!currentCat || currentCat === "" || currentCat === "Other" || currentCat === "general") {
          const inferred = inferCategory(credit);
          if (inferred) {
            updates.credit_category = inferred;
            updates.project_type = inferred;
          }
        }

        // === APPLY UPDATES ===
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("credits")
            .update(updates)
            .eq("id", credit.id);

          if (updateError) {
            console.error(`Failed to update ${credit.id}:`, updateError);
            errors++;
          } else {
            updated++;
            console.log(`Enriched ${credit.id}: ${JSON.stringify(updates)}`);
          }
        }

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        console.error(`Error processing ${credit.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: credits.length,
        updated,
        errors,
        message: `Enriched ${updated} credits (${errors} errors)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Enrichment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
