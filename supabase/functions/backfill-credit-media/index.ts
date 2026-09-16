import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category inference from project name, role, platform
const CATEGORY_RULES: [RegExp, string][] = [
  [/after\s*movie|promo\s*video|event\s*recap|highlights?/i, "live_event"],
  [/carnival|mas\b|jouvert/i, "carnival"],
  [/festival|fest\b/i, "festival"],
  [/concert|live\s+at|tour\b/i, "concert"],
  [/fashion\s*show|runway|collection/i, "fashion_show"],
  [/pageant|awards?\s*show/i, "awards_show"],
  [/conference|summit|expo\b/i, "conference"],
  [/music\s*video|official\s*video|lyric\s*video/i, "music_video"],
  [/album\b|deluxe\b|remaster/i, "album"],
  [/single\b|remix\b/i, "single"],
  [/\bep\b/i, "ep"],
  [/podcast|episode\s*\d|talks?\b|interview/i, "podcast"],
  [/season\s*\d|s\d+e\d+|series\b|web\s*series/i, "tv"],
  [/documentary|doc\b/i, "documentary"],
  [/short\s*film|short\b/i, "short_film"],
  [/film\b|movie\b|feature\b/i, "film"],
  [/vlog|youtube|behind\s*the\s*scenes|bts\b/i, "youtube_series"],
  [/livestream|live\s*stream/i, "livestream"],
  [/commercial|brand\s*campaign|ad\s*campaign/i, "commercial"],
  [/corporate|company/i, "corporate"],
  [/editorial|lookbook|shoot\b/i, "editorial_shoot"],
  [/styling|beauty/i, "styling"],
  [/exhibition|gallery|art\s*show/i, "art_exhibition"],
  [/mural|graffiti/i, "mural"],
  [/photography|photo\s*series/i, "photography"],
  [/animation|animated/i, "animation"],
];

function inferCategory(name: string, role: string, platform: string, source: string): string | null {
  const text = `${name} ${role} ${platform}`.toLowerCase();
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  const s = source.toLowerCase();
  if (["spotify", "soundcloud", "musicbrainz", "discogs"].includes(s)) return "album";
  if (["tmdb", "imdb"].includes(s)) return "film";
  if (s === "youtube") return "music_video";
  return null;
}

async function searchYouTube(query: string, apiKey: string): Promise<{ videoId: string; title: string } | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    return { videoId: item.id.videoId, title: item.snippet.title };
  } catch (e) {
    console.error("YouTube search failed:", e);
    return null;
  }
}

async function getSpotifyThumbnail(query: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) { await tokenRes.text(); return null; }
    const { access_token } = await tokenRes.json();

    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album,track&limit=1`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!searchRes.ok) { await searchRes.text(); return null; }
    const searchData = await searchRes.json();
    
    const album = searchData.albums?.items?.[0];
    const track = searchData.tracks?.items?.[0];
    return album?.images?.[0]?.url || track?.album?.images?.[0]?.url || null;
  } catch (e) {
    console.error("Spotify search failed:", e);
    return null;
  }
}

async function searchTMDB(query: string, apiKey: string, year?: number): Promise<string | null> {
  try {
    let url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;
    if (year) url += `&year=${year}`;
    
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    
    const posterPath = result.poster_path || result.backdrop_path || result.profile_path;
    if (!posterPath) return null;
    
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  } catch (e) {
    console.error("TMDB search failed:", e);
    return null;
  }
}

// Generate a gradient-based placeholder cover using a deterministic color from project name
function generatePlaceholderUrl(projectName: string, category: string): string | null {
  // We'll use a placeholder service that generates nice covers
  const encoded = encodeURIComponent(projectName.slice(0, 40));
  // Use via.placeholder or a gradient service - return null to skip for now
  // Placeholder covers are generated client-side instead
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const { user_id, batch_size = 50, dry_run = false } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
    const spotifyClientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const spotifyClientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    const tmdbApiKey = Deno.env.get("TMDB_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch credits missing thumbnail
    let query = supabase
      .from("credits")
      .select("id, project_name, role, url, primary_media_url, thumbnail_url, credit_category, project_type, platform, source, media_type, year")
      .or("thumbnail_url.is.null,thumbnail_url.eq.")
      .limit(batch_size);

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: credits, error } = await query;
    if (error) throw error;
    if (!credits || credits.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No credits to backfill", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BACKFILL] Processing ${credits.length} credits`);

    let updated = 0;
    let errors = 0;
    const results: any[] = [];

    for (const credit of credits) {
      try {
        const updates: Record<string, any> = {};
        const rawName = credit.project_name || "";
        // Clean name for search: strip brackets, episode info, quotes
        const name = rawName
          .replace(/\[.*?\]/g, '')    // [S2-16 ep]
          .replace(/\(.*?\)/g, '')    // (2024)
          .replace(/[''"]/g, '')      // quotes
          .replace(/\s+/g, ' ')
          .trim();
        const src = (credit.source || "").toLowerCase();
        const cat = (credit.credit_category || "").toLowerCase();
        const needsUrl = !credit.url && !credit.primary_media_url;
        const needsThumbnail = !credit.thumbnail_url;

        if (!needsThumbnail) continue;

        // === 1. Try YouTube for video sources ===
        if (youtubeApiKey && (src === "youtube" || cat.includes("video") || cat === "youtube_series")) {
          const result = await searchYouTube(name, youtubeApiKey);
          if (result) {
            const videoUrl = `https://www.youtube.com/watch?v=${result.videoId}`;
            if (needsUrl) {
              updates.url = videoUrl;
              updates.primary_media_url = videoUrl;
              updates.media_type = "video";
            }
            updates.thumbnail_url = `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
          }
        }

        // === 2. Try Spotify for music sources ===
        if (!updates.thumbnail_url && spotifyClientId && spotifyClientSecret && 
            (src === "spotify" || src === "musicbrainz" || src === "discogs" || 
             cat === "album" || cat === "single" || cat === "ep" || cat === "music")) {
          const thumb = await getSpotifyThumbnail(name, spotifyClientId, spotifyClientSecret);
          if (thumb) updates.thumbnail_url = thumb;
        }

        // === 3. Try TMDB for film/TV sources ===
        if (!updates.thumbnail_url && tmdbApiKey && 
            (src === "tmdb" || src === "imdb" || src === "manual" || src === "ai_discovered" ||
             cat === "film" || cat === "tv" || cat === "documentary" || cat === "short_film" ||
             cat === "general" || cat === "other" || cat === "")) {
          const thumb = await searchTMDB(name, tmdbApiKey, credit.year || undefined);
          if (thumb) updates.thumbnail_url = thumb;
        }

        // === 4. If still no thumbnail, try YouTube as universal fallback ===
        if (!updates.thumbnail_url && youtubeApiKey && name.length > 2) {
          const searchQuery = credit.role ? `${name} ${credit.role}` : name;
          const result = await searchYouTube(searchQuery, youtubeApiKey);
          if (result) {
            updates.thumbnail_url = `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
            if (needsUrl) {
              updates.url = `https://www.youtube.com/watch?v=${result.videoId}`;
              updates.primary_media_url = `https://www.youtube.com/watch?v=${result.videoId}`;
              updates.media_type = "video";
            }
          }
        }

        // === 5. Fix category ===
        const currentCat = credit.credit_category || "";
        const isGeneric = !currentCat || currentCat === "video" || currentCat === "Other" || currentCat === "general" || currentCat === "imported";
        if (isGeneric) {
          const inferred = inferCategory(name, credit.role || "", credit.platform || "", credit.source || "");
          if (inferred) {
            updates.credit_category = inferred;
            updates.project_type = inferred;
          }
        }

        // === 6. Apply ===
        if (Object.keys(updates).length > 0) {
          if (dry_run) {
            results.push({ id: credit.id, name, updates });
          } else {
            const { error: updateError } = await supabase
              .from("credits")
              .update(updates)
              .eq("id", credit.id);
            if (updateError) {
              console.error(`[BACKFILL] Failed ${credit.id}:`, updateError);
              errors++;
            } else {
              updated++;
              console.log(`[BACKFILL] Updated ${credit.id} (${name}): ${JSON.stringify(updates)}`);
            }
          }
        }

        // Rate limit between API calls
        await new Promise((r) => setTimeout(r, 150));
      } catch (e) {
        console.error(`[BACKFILL] Error ${credit.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: credits.length,
        updated,
        errors,
        dry_run,
        results: dry_run ? results : undefined,
        message: dry_run
          ? `Would update ${results.length} of ${credits.length} credits`
          : `Backfilled ${updated} credits (${errors} errors)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[BACKFILL] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
