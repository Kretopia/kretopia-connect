import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ScrapedChannel {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: string;
  videoCount?: string;
}

interface ScrapedVideo {
  id: string;
  title: string;
  publishedText?: string;
  thumbnail?: string;
  viewText?: string;
}

function extractYtData(html: string): any | null {
  const m = html.match(/var\s+ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function walkForVideos(node: any, out: ScrapedVideo[], seen: Set<string>) {
  if (!node || typeof node !== 'object') return;
  // richItemRenderer for /videos tab, gridVideoRenderer for older layouts
  const v = node.richItemRenderer?.content?.videoRenderer || node.gridVideoRenderer || node.videoRenderer;
  if (v && v.videoId && !seen.has(v.videoId)) {
    seen.add(v.videoId);
    out.push({
      id: v.videoId,
      title: v.title?.runs?.[0]?.text || v.title?.simpleText || '',
      publishedText: v.publishedTimeText?.simpleText,
      thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
      viewText: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText,
    });
  }
  if (Array.isArray(node)) { for (const c of node) walkForVideos(c, out, seen); return; }
  for (const k in node) walkForVideos(node[k], out, seen);
}

function parseRelativeDate(text?: string): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s+(year|month|week|day|hour)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const now = new Date();
  if (unit === 'year') return now.getFullYear() - n;
  if (unit === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.getFullYear(); }
  if (unit === 'week') { const d = new Date(now); d.setDate(d.getDate() - n * 7); return d.getFullYear(); }
  if (unit === 'day') { const d = new Date(now); d.setDate(d.getDate() - n); return d.getFullYear(); }
  return now.getFullYear();
}

async function fetchChannelPage(handleOrId: string): Promise<{ html: string; url: string } | null> {
  // Try @handle first, then channel/UC...
  const isUC = /^UC[a-zA-Z0-9_-]{20,}$/.test(handleOrId);
  const url = isUC
    ? `https://www.youtube.com/channel/${handleOrId}/videos`
    : `https://www.youtube.com/@${handleOrId.replace(/^@/, '')}/videos`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) return null;
  return { html: await res.text(), url };
}

function extractChannelInfo(ytData: any, html: string): ScrapedChannel | null {
  const header = ytData?.header?.c4TabbedHeaderRenderer || ytData?.header?.pageHeaderRenderer;
  const meta = ytData?.metadata?.channelMetadataRenderer;
  const externalId = meta?.externalId || (html.match(/externalId":"(UC[^"]+)"/) || [])[1];
  if (!externalId) return null;
  const title = meta?.title || header?.title || '';
  const description = meta?.description || '';
  const customUrl = meta?.vanityChannelUrl?.split('/').pop();
  const thumbnail = meta?.avatar?.thumbnails?.slice(-1)?.[0]?.url || header?.avatar?.thumbnails?.slice(-1)?.[0]?.url;
  // subscriber + video counts often hidden; try header
  const subText = header?.subscriberCountText?.simpleText || header?.subscriberCountText?.accessibility?.accessibilityData?.label;
  const vidText = header?.videosCountText?.runs?.[0]?.text;
  return {
    id: externalId,
    title,
    description,
    customUrl,
    thumbnail,
    subscriberCount: subText,
    videoCount: vidText,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { channelName, channelId, channelUrl, searchOnly, role: roleOverride } = await req.json();
    console.log('YouTube scrape request:', { channelName, channelId, channelUrl, searchOnly });

    // Resolve target: handle, UC id, or URL
    let target: string | null = channelId || null;
    if (!target && channelUrl) {
      const patterns = [
        /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/,
        /youtube\.com\/@([a-zA-Z0-9_.\-]+)/,
        /youtube\.com\/c\/([a-zA-Z0-9_.\-]+)/,
        /youtube\.com\/user\/([a-zA-Z0-9_.\-]+)/,
      ];
      for (const p of patterns) {
        const m = channelUrl.match(p);
        if (m) { target = m[1]; break; }
      }
    }
    if (!target && channelName) target = channelName.replace(/^@/, '');

    if (!target) {
      return new Response(JSON.stringify({ success: false, error: 'Provide channelId, channelUrl, or channelName' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const page = await fetchChannelPage(target);
    if (!page) {
      return new Response(JSON.stringify({ success: false, error: 'Could not fetch channel page' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ytData = extractYtData(page.html);
    if (!ytData) {
      return new Response(JSON.stringify({ success: false, error: 'Could not parse channel data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const channelData = extractChannelInfo(ytData, page.html);
    if (!channelData) {
      return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (searchOnly) {
      return new Response(JSON.stringify({
        success: true,
        searchResults: [{
          id: channelData.id,
          name: channelData.title,
          thumb: channelData.thumbnail,
          details: channelData.description?.slice(0, 100) || '',
        }],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const videos: ScrapedVideo[] = [];
    walkForVideos(ytData, videos, new Set());
    console.log(`Scraped ${videos.length} videos from ${channelData.title}`);

    const role = roleOverride || 'Creator';
    const credits = videos.map(v => ({
      user_id: user.id,
      source_id: v.id,
      source: 'youtube',
      project_name: v.title,
      role,
      year: parseRelativeDate(v.publishedText),
      url: `https://youtube.com/watch?v=${v.id}`,
      verification_url: `https://youtube.com/watch?v=${v.id}`,
      thumbnail_url: v.thumbnail,
      primary_media_url: `https://youtube.com/watch?v=${v.id}`,
      media_type: 'video',
      platform: 'youtube',
      credit_category: 'video',
      verification_status: 'verified',
      metadata: {
        viewText: v.viewText,
        publishedText: v.publishedText,
        thumbnail: v.thumbnail,
      },
    }));

    if (credits.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('credits')
        .upsert(credits, { onConflict: 'user_id,source_id,source', ignoreDuplicates: true });
      if (insertError) console.error('Insert error:', insertError);
    }

    await supabaseClient.from('connected_platforms').upsert({
      user_id: user.id,
      platform: 'youtube',
      platform_username: channelData.title,
      platform_user_id: channelData.id,
      verified_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      platform_data: {
        customUrl: channelData.customUrl,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        thumbnail: channelData.thumbnail,
      },
    }, { onConflict: 'user_id,platform' });

    return new Response(JSON.stringify({
      success: true,
      channel: channelData,
      creditsImported: credits.length,
      searchResults: [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('YouTube scraper error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
