import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { playlistId } = await req.json();
    if (!playlistId) {
      return new Response(JSON.stringify({ error: "playlistId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try RSS feed first
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const feedRes = await fetch(feedUrl);

    if (feedRes.ok) {
      const xml = await feedRes.text();
      const entries = parseRSS(xml);
      if (entries.length > 0) {
        console.log(`RSS returned ${entries.length} episodes`);
        return new Response(JSON.stringify({ episodes: entries }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: scrape playlist page
    console.log("RSS feed failed, falling back to playlist page scrape");
    const pageUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!pageRes.ok) throw new Error(`Playlist page error: ${pageRes.status}`);

    const html = await pageRes.text();

    // Extract ytInitialData JSON
    const dataMatch = html.match(/var\s+ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (!dataMatch) {
      console.error("Could not find ytInitialData in page");
      // Last resort: extract video IDs with simple regex
      const videoIds = [...new Set(
        [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1])
      )];
      console.log(`Regex fallback found ${videoIds.length} video IDs`);
      const episodes = videoIds.slice(0, 20).map(id => ({
        videoId: id,
        title: "",
        description: "",
        thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        publishedAt: "",
      }));
      return new Response(JSON.stringify({ episodes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ytData = JSON.parse(dataMatch[1]);

    // Navigate JSON structure to find playlist items
    const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    let items: any[] = [];
    for (const tab of tabs) {
      const contents = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const section of contents) {
        const playlistItems = section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];
        if (playlistItems.length > 0) {
          items = playlistItems;
          break;
        }
      }
      if (items.length > 0) break;
    }

    console.log(`Parsed ${items.length} playlist items from ytInitialData`);

    const episodes = items
      .filter((item: any) => item.playlistVideoRenderer)
      .map((item: any) => {
        const r = item.playlistVideoRenderer;
        const videoId = r.videoId || "";
        const title = r.title?.runs?.[0]?.text || r.title?.simpleText || "";
        const thumbnail = r.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        return {
          videoId,
          title,
          description: "",
          thumbnail,
          publishedAt: "",
        };
      })
      .filter((ep: any) => ep.videoId && ep.title);

    return new Response(JSON.stringify({ episodes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-youtube-playlist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseRSS(xml: string) {
  const entries: any[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const get = (tag: string) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
      return m ? m[1].trim() : "";
    };
    const id = (() => {
      const vidMatch = entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/);
      return vidMatch ? vidMatch[1] : "";
    })();
    const title = get("title");
    const published = get("published");
    const updated = get("updated");
    const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/);
    const description = descMatch ? descMatch[1].trim() : "";
    const thumbMatch = entry.match(/<media:thumbnail[^>]*url="([^"]*)"[^>]*\/>/);
    const thumbnail = thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    if (id && title) {
      entries.push({ videoId: id, title, description: description.slice(0, 300), thumbnail, publishedAt: published || updated });
    }
  }
  return entries;
}
