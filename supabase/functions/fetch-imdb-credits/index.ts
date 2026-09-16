import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ImdbCredit {
  titleId: string;
  title: string;
  role: string;        // e.g. "Cinematographer", "steadicam operator"
  department: string;  // top-level: "Camera and Electrical Department", "Cinematographer", etc.
  year: number | null;
  type?: string;       // "Short", "Music Video", etc.
  posterUrl?: string;
}

async function fetchImdb(path: string): Promise<string | null> {
  // Direct fetch first (cheap)
  try {
    const res = await fetch(`https://www.imdb.com${path}`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 5000) return html;
      console.warn(`IMDb returned thin response (${html.length} bytes), falling back to Firecrawl`);
    } else {
      console.warn(`IMDb direct fetch returned ${res.status}, falling back to Firecrawl`);
    }
  } catch (e) {
    console.warn('IMDb direct fetch error, falling back to Firecrawl:', e);
  }

  // Fallback: Firecrawl (handles JS rendering + anti-bot)
  const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!fcKey) {
    console.error('FIRECRAWL_API_KEY not set; cannot scrape IMDb');
    return null;
  }
  const fcRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: `https://www.imdb.com${path}`,
      formats: ['rawHtml', 'html'],
      onlyMainContent: false,
    }),
  });
  if (!fcRes.ok) {
    console.error(`Firecrawl scrape failed: ${fcRes.status} ${await fcRes.text()}`);
    return null;
  }
  const fcData = await fcRes.json();
  // v2 returns either { data: { rawHtml, html } } or top-level
  const html = fcData?.data?.rawHtml || fcData?.data?.html || fcData?.rawHtml || fcData?.html;
  if (!html) {
    console.error('Firecrawl returned no html');
    return null;
  }
  console.log(`Firecrawl returned ${html.length} bytes for ${path}`);
  return html;
}

function extractName(html: string): string | null {
  // JSON-LD has the cleanest name
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      if (ld.name) return ld.name;
    } catch { /* ignore */ }
  }
  const m = html.match(/<title>([^-<]+)/);
  return m ? m[1].trim() : null;
}

function extractMainPhoto(html: string): string | null {
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      if (ld.image) return ld.image;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * IMDb embeds the full filmography in a __NEXT_DATA__ JSON blob.
 * We pull every credit, normalized by department.
 */
function extractCredits(html: string): ImdbCredit[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) {
    console.warn('No __NEXT_DATA__ found, falling back to anchor scrape');
    return extractCreditsFromHtml(html);
  }
  let data: any;
  try { data = JSON.parse(m[1]); } catch (e) {
    console.error('Failed to parse __NEXT_DATA__:', e);
    return extractCreditsFromHtml(html);
  }

  const out: ImdbCredit[] = [];
  const seen = new Set<string>();
  const groups: any[] = [];
  const main = data?.props?.pageProps?.mainColumnData;
  if (main?.released?.edges) groups.push(...main.released.edges);
  if (main?.unreleased?.edges) groups.push(...main.unreleased.edges);
  console.log(`IMDb groups found: ${groups.length}`);

  for (const g of groups) {
    const creditEdges = g?.node?.credits?.edges || [];
    for (const ce of creditEdges) {
      const cn = ce?.node;
      const title = cn?.title;
      if (!title?.id) continue;
      const titleId = title.id;
      const titleText = title.titleText?.text || title.originalTitleText?.text || '';
      const year = title.releaseYear?.year || title.releaseDate?.year || null;
      const type = title.titleType?.text;
      const posterUrl = title.primaryImage?.url;

      const roleEdges = cn?.creditedRoles?.edges || [];
      if (roleEdges.length === 0) {
        const key = `${titleId}|crew`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ titleId, title: titleText, role: 'Crew', department: 'Crew', year, type, posterUrl });
        }
        continue;
      }
      for (const re of roleEdges) {
        const rn = re?.node;
        const role = rn?.text || rn?.category?.text || 'Crew';
        const department = rn?.category?.text || 'Crew';
        const key = `${titleId}|${role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ titleId, title: titleText, role, department, year, type, posterUrl });
      }
    }
  }
  return out;
}

/** Fallback: parse credits from rendered HTML anchors when __NEXT_DATA__ is absent */
function extractCreditsFromHtml(html: string): ImdbCredit[] {
  const out: ImdbCredit[] = [];
  // Very loose regex; better than nothing. Looks for /title/tt..../ links with following metadata
  const titleRe = /\/title\/(tt\d+)\/[^"]*"[^>]*>([^<]+)</g;
  const seen = new Set<string>();
  let m;
  while ((m = titleRe.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ titleId: id, title: m[2].trim(), role: 'Crew', department: 'Unknown', year: null });
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { imdbUrl, imdbId: rawId, searchOnly } = body;

    // Extract nm-id from any input
    let imdbId: string | null = rawId || null;
    if (!imdbId && imdbUrl) {
      const m = imdbUrl.match(/\/name\/(nm\d+)/);
      if (m) imdbId = m[1];
    }
    if (!imdbId) {
      return new Response(JSON.stringify({ success: false, error: 'Provide imdbId or imdbUrl' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Scraping IMDb for ${imdbId}`);

    // Fetch main page (has bio + known-for) and full filmography page
    const [mainHtml, fullHtml] = await Promise.all([
      fetchImdb(`/name/${imdbId}/`),
      fetchImdb(`/name/${imdbId}/fullcredits/`),
    ]);

    if (!mainHtml) {
      return new Response(JSON.stringify({ success: false, error: 'IMDb page not accessible' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const personName = extractName(mainHtml) || 'Unknown';
    const profileImg = extractMainPhoto(mainHtml);
    console.log(`Person: ${personName}`);

    if (searchOnly) {
      return new Response(JSON.stringify({
        success: true,
        personFound: true,
        personData: { id: imdbId, name: personName, profilePath: profileImg },
        searchResults: [{ id: imdbId, name: personName, profile_path: profileImg, known_for_department: 'Camera/Cinematographer' }],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prefer fullcredits for completeness, fall back to main page
    const credits = extractCredits(fullHtml || '') || [];
    const fallback = credits.length === 0 ? extractCredits(mainHtml) : credits;
    console.log(`Extracted ${fallback.length} credits`);

    const rows = fallback.map(c => ({
      user_id: user.id,
      source_id: `imdb-${c.titleId}-${c.role}`,
      source: 'imdb',
      project_name: c.title,
      role: c.role,
      year: c.year,
      url: `https://www.imdb.com/title/${c.titleId}/`,
      verification_url: `https://www.imdb.com/title/${c.titleId}/`,
      thumbnail_url: c.posterUrl,
      primary_media_url: c.posterUrl,
      media_type: c.type === 'Music Video' ? 'video' : 'film',
      platform: 'imdb',
      credit_category: c.department.toLowerCase().includes('cinemat') || c.department.toLowerCase().includes('camera') ? 'cinematography' : 'film',
      verification_status: 'verified',
      metadata: {
        department: c.department,
        type: c.type,
        imdbTitleId: c.titleId,
      },
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from('credits')
        .upsert(rows, { onConflict: 'user_id,source_id,source', ignoreDuplicates: true });
      if (insertErr) console.error('Insert error:', insertErr);
    }

    await supabase.from('connected_platforms').upsert({
      user_id: user.id,
      platform: 'imdb',
      platform_username: personName,
      platform_user_id: imdbId,
      verified_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      platform_data: { profileImg, totalCredits: rows.length },
    }, { onConflict: 'user_id,platform' });

    return new Response(JSON.stringify({
      success: true,
      personFound: true,
      personData: { id: imdbId, name: personName, profilePath: profileImg },
      creditsImported: rows.length,
      credits: rows.slice(0, 5),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('IMDb scraper error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
