// Spotify discography scraper using Firecrawl.
// Pulls artist name + albums/singles from open.spotify.com/artist/<id> and inserts as credits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2";

function extractArtistId(input: string): string | null {
  if (!input) return null;
  // Already a 22-char base62 id
  if (/^[A-Za-z0-9]{22}$/.test(input)) return input;
  const m = input.match(/artist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

interface Release {
  title: string;
  url: string;
  year?: number | null;
  release_type?: string | null; // album | single | ep | compilation
  thumbnail_url?: string | null;
}

async function scrapeArtist(artistUrl: string, apiKey: string): Promise<{
  artistName: string | null;
  releases: Release[];
}> {
  const schema = {
    type: "object",
    properties: {
      artist_name: { type: "string" },
      releases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            year: { type: "number" },
            release_type: { type: "string", enum: ["album", "single", "ep", "compilation"] },
            thumbnail_url: { type: "string" },
          },
          required: ["title", "url"],
        },
      },
    },
    required: ["artist_name", "releases"],
  };

  const res = await fetch(`${FIRECRAWL}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: artistUrl,
      onlyMainContent: false,
      waitFor: 2500,
      formats: [
        {
          type: "json",
          schema,
          prompt:
            "Extract the artist's display name and ALL of their releases visible on this Spotify artist page (Discography sections: albums, singles, EPs, compilations, appears-on). For each release: title, full Spotify URL (https://open.spotify.com/album/...), release year if visible, type (album/single/ep/compilation), and the cover image URL if available.",
        },
      ],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Firecrawl ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const extracted = json?.data?.json ?? json?.json ?? {};
  const releases: Release[] = Array.isArray(extracted.releases) ? extracted.releases : [];
  // De-dupe by URL
  const seen = new Set<string>();
  const unique = releases.filter((r) => {
    if (!r?.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  return { artistName: extracted.artist_name || null, releases: unique };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { spotifyUrl, artistId: rawId, role: roleOverride, searchOnly } = body ?? {};

    const artistId = extractArtistId(rawId || spotifyUrl || "");
    if (!artistId) {
      return new Response(
        JSON.stringify({ success: false, error: "Provide a valid Spotify artist URL or ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fullUrl = `https://open.spotify.com/artist/${artistId}/discography/all`;
    console.log(`[fetch-spotify-credits] Scraping ${fullUrl}`);
    const { artistName, releases } = await scrapeArtist(fullUrl, FIRECRAWL_API_KEY);
    console.log(`[fetch-spotify-credits] artist=${artistName} releases=${releases.length}`);

    if (searchOnly) {
      return new Response(
        JSON.stringify({ success: true, artistName, releases }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (releases.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "No releases found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const role = roleOverride || "Recording Artist";
    const rows = releases.slice(0, 60).map((r) => ({
      user_id: user.id,
      project_name: r.title.slice(0, 200),
      role,
      year: r.year ?? null,
      url: r.url,
      thumbnail_url: r.thumbnail_url ?? null,
      primary_media_url: r.thumbnail_url ?? r.url,
      media_type: "audio",
      platform: "spotify",
      source: "spotify",
      source_id: r.url.split("/").pop() ?? null,
      verification_status: "auto_discovered",
      credit_category: "music",
      project_type: r.release_type || "release",
    }));

    // Avoid duplicates: skip rows whose source_id already exists for this user
    const existingIds = new Set<string>();
    const sourceIds = rows.map((r) => r.source_id).filter(Boolean) as string[];
    if (sourceIds.length) {
      const { data: existing } = await supabase
        .from("credits")
        .select("source_id")
        .eq("user_id", user.id)
        .eq("source", "spotify")
        .in("source_id", sourceIds);
      (existing ?? []).forEach((e: any) => e?.source_id && existingIds.add(e.source_id));
    }
    const fresh = rows.filter((r) => !r.source_id || !existingIds.has(r.source_id));

    let imported = 0;
    if (fresh.length > 0) {
      const { error: insErr, count } = await supabase
        .from("credits")
        .insert(fresh, { count: "exact" });
      if (insErr) {
        console.error("[fetch-spotify-credits] insert error", insErr);
        throw insErr;
      }
      imported = count ?? fresh.length;
    }

    // Persist platform link
    await supabase.from("connected_platforms").upsert(
      {
        user_id: user.id,
        platform: "spotify",
        platform_user_id: artistId,
        platform_username: artistName,
        last_synced_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" },
    );

    return new Response(
      JSON.stringify({ success: true, imported, total: releases.length, artistName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[fetch-spotify-credits] error", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
