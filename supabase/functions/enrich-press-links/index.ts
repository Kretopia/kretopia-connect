import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, scrape_website } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any = { enriched_press: 0, new_press: 0, enriched_awards: 0 };

    // 1. Enrich existing press links that are missing data
    const { data: pressLinks } = await supabase
      .from('press_links')
      .select('id, url, title, publication, image_url, excerpt, og_data')
      .eq('user_id', user_id)
      .or('publication.is.null,image_url.is.null,excerpt.is.null');

    if (pressLinks && pressLinks.length > 0) {
      for (const link of pressLinks) {
        if (!link.url) continue;
        try {
          const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: link.url,
              formats: ['markdown'],
              onlyMainContent: true,
            }),
          });

          const scrapeData = await scrapeRes.json();
          const metadata = scrapeData?.data?.metadata || scrapeData?.metadata;

          if (metadata) {
            const updates: Record<string, any> = {};
            if (!link.publication && metadata.ogSiteName) updates.publication = metadata.ogSiteName;
            if (!link.image_url && (metadata.ogImage || metadata.image)) updates.image_url = metadata.ogImage || metadata.image;
            if (!link.excerpt && metadata.description) updates.excerpt = metadata.description;
            
            // Fix HTML entities in title
            if (link.title && (link.title.includes('&#') || link.title.includes('&amp;'))) {
              const decoded = link.title
                .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n)))
                .replace(/&#x([0-9a-fA-F]+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 16)))
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#8211;/g, '\u2013')
                .replace(/&#8212;/g, '\u2014')
                .replace(/&#8216;/g, '\u2018')
                .replace(/&#8217;/g, '\u2019')
                .replace(/&#8220;/g, '\u201C')
                .replace(/&#8221;/g, '\u201D');
              if (decoded !== link.title) updates.title = decoded;
            }

            // Store OG data
            if (!link.og_data) {
              updates.og_data = {
                title: metadata.title || metadata.ogTitle,
                description: metadata.description || metadata.ogDescription,
                image: metadata.ogImage || metadata.image,
                site_name: metadata.ogSiteName,
              };
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('press_links').update(updates).eq('id', link.id);
              results.enriched_press++;
            }
          }
        } catch (e) {
          console.error(`Failed to enrich press link ${link.id}:`, e);
        }
      }
    }

    // 2. Optionally scrape user's website for press/awards mentions
    if (scrape_website) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('website, full_name, imdb_url')
        .eq('user_id', user_id)
        .maybeSingle();

      if (profile?.website) {
        try {
          // Search for press mentions of this creator
          const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `"${profile.full_name}" interview OR feature OR award OR press`,
              limit: 10,
            }),
          });

          const searchData = await searchRes.json();
          const searchResults = searchData?.data || [];

          // Get existing press link URLs to avoid duplicates
          const { data: existingLinks } = await supabase
            .from('press_links')
            .select('url')
            .eq('user_id', user_id);
          const existingUrls = new Set((existingLinks || []).map((l: any) => l.url));

          for (const result of searchResults) {
            if (!result.url || existingUrls.has(result.url)) continue;
            // Skip social media / non-press URLs
            if (/facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com/i.test(result.url)) continue;

            await supabase.from('press_links').insert({
              user_id,
              title: result.title || 'Press Mention',
              url: result.url,
              publication: result.metadata?.ogSiteName || new URL(result.url).hostname.replace('www.', ''),
              image_url: result.metadata?.ogImage || null,
              excerpt: result.description || result.metadata?.description || null,
              verification_status: 'auto_discovered',
            });
            results.new_press++;
            existingUrls.add(result.url);
          }
        } catch (e) {
          console.error('Failed to search for press mentions:', e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in enrich-press-links:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
