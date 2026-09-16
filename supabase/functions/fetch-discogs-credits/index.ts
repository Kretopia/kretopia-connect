import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { artistName, discogsUrl, artistId, searchOnly } = await req.json();

    if (!artistName && !discogsUrl && !artistId) {
      return new Response(JSON.stringify({ error: 'Provide artistName, discogsUrl, or artistId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const DISCOGS_TOKEN = Deno.env.get('DISCOGS_TOKEN');
    
    if (!DISCOGS_TOKEN) {
      return new Response(JSON.stringify({ 
        error: 'Discogs integration not configured',
        details: 'DISCOGS_TOKEN not set'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let credits: any[] = [];
    let artistData: any = null;

    // If artistId is provided, use that directly (user selected from search)
    if (artistId) {
      console.log(`Fetching Discogs artist by ID: ${artistId}`);
      
      // Get artist details
      const artistRes = await fetch(
        `https://api.discogs.com/artists/${artistId}?token=${DISCOGS_TOKEN}`,
        { headers: { 'User-Agent': 'ThriveIN/1.0 +https://thrivein.io' } }
      );
      artistData = await artistRes.json();
      
      // Get artist releases
      const releasesRes = await fetch(
        `https://api.discogs.com/artists/${artistId}/releases?sort=year&sort_order=desc&per_page=100&token=${DISCOGS_TOKEN}`,
        { headers: { 'User-Agent': 'ThriveIN/1.0 +https://thrivein.io' } }
      );
      const releasesData = await releasesRes.json();
      
      credits = processReleases(releasesData.releases || []);
    } else {
      // Search for artist
      const searchRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&token=${DISCOGS_TOKEN}`,
        { headers: { 'User-Agent': 'ThriveIN/1.0 +https://thrivein.io' } }
      );
      const searchData = await searchRes.json();
      
      // If searchOnly, return results without importing
      if (searchOnly) {
        return new Response(JSON.stringify({
          success: true,
          searchResults: (searchData.results || []).slice(0, 10).map((a: any) => ({
            id: a.id,
            name: a.title,
            thumb: a.thumb,
            cover_image: a.cover_image,
            type: a.type,
          })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (searchData.results && searchData.results.length > 0) {
        artistData = searchData.results[0];

        // Get artist releases
        const releasesRes = await fetch(
          `https://api.discogs.com/artists/${artistData.id}/releases?sort=year&sort_order=desc&per_page=100&token=${DISCOGS_TOKEN}`,
          { headers: { 'User-Agent': 'ThriveIN/1.0 +https://thrivein.io' } }
        );
        const releasesData = await releasesRes.json();

        credits = processReleases(releasesData.releases || []);
      }
    }
    
    function processReleases(releases: any[]) {
      return releases.slice(0, 50).map((release: any) => ({
        sourceId: `discogs-${release.id}`,
        creditType: release.type === 'master' ? 'album' : (release.format?.includes('Single') ? 'single' : 'album'),
        title: release.title,
        role: release.role || release.artist || 'Artist',
        year: release.year || undefined,
        metadata: {
          thumbUrl: release.thumb,
          label: release.label,
          format: release.format,
          catno: release.catno,
          resourceUrl: release.resource_url,
        },
        verificationUrl: `https://www.discogs.com/release/${release.id}`,
      }));
    }

    // Import credits to database
    if (credits.length > 0) {
      for (const credit of credits) {
        await supabase
          .from('verified_credits')
          .upsert({
            user_id: user.id,
            source: 'discogs',
            source_id: credit.sourceId,
            credit_type: credit.creditType,
            title: credit.title,
            role: credit.role,
            year: credit.year,
            metadata: credit.metadata,
            verification_url: credit.verificationUrl,
            verified_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,source,source_id',
          });
      }

      // Update profile discogs_verified status
      await supabase
        .from('profiles')
        .update({ 
          discogs_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      // Store as connected platform
      await supabase
        .from('connected_platforms')
        .upsert({
          user_id: user.id,
          platform: 'discogs',
          platform_user_id: artistData?.id?.toString(),
          platform_username: artistName,
          platform_data: {
            discogsId: artistData?.id,
            thumbUrl: artistData?.thumb,
            coverImage: artistData?.cover_image,
            totalReleases: credits.length,
          },
          last_synced_at: new Date().toISOString(),
          verified_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });
    }

    return new Response(JSON.stringify({
      success: true,
      artistFound: !!artistData,
      artistData: artistData ? {
        id: artistData.id,
        title: artistData.title,
        thumbUrl: artistData.thumb,
      } : null,
      creditsImported: credits.length,
      credits: credits.slice(0, 10),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Fetch Discogs credits error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
