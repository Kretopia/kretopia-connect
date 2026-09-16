import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// MusicBrainz is 100% free - no API key required!
// Rate limit: 1 request per second with User-Agent header
const MB_API_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'ThriveIN/1.0 (https://thrivein.io)';

interface MusicBrainzArtist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
}

interface MusicBrainzRecording {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: Array<{ name: string; artist: { id: string; name: string } }>;
  releases?: Array<{ id: string; title: string; date?: string }>;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  'release-group'?: { id: string; 'primary-type'?: string };
  'artist-credit'?: Array<{ name: string; artist: { id: string; name: string } }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { artistName, artistId, searchOnly } = await req.json();
    console.log('MusicBrainz request:', { artistName, artistId, searchOnly });

    let artistData: MusicBrainzArtist | null = null;
    let credits: any[] = [];
    let allSearchResults: MusicBrainzArtist[] = [];

    // Helper to make MusicBrainz requests with rate limiting
    const mbFetch = async (endpoint: string) => {
      const response = await fetch(`${MB_API_BASE}${endpoint}&fmt=json`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`MusicBrainz API error: ${response.status}`);
      }
      return response.json();
    };

    if (artistId) {
      console.log(`Fetching MusicBrainz artist by ID: ${artistId}`);
      
      // Get artist details
      const artistResponse = await mbFetch(`/artist/${artistId}?inc=releases+recordings+release-groups+works`);
      artistData = {
        id: artistResponse.id,
        name: artistResponse.name,
        type: artistResponse.type,
        country: artistResponse.country,
        disambiguation: artistResponse.disambiguation,
      };

      // Get releases (albums, singles, EPs)
      const releasesResponse = await mbFetch(`/release?artist=${artistId}&limit=100`);
      
      credits = (releasesResponse.releases || []).map((release: MusicBrainzRelease) => ({
        sourceId: release.id,
        source: 'musicbrainz',
        creditType: release['release-group']?.['primary-type']?.toLowerCase() || 'album',
        title: release.title,
        role: 'Artist',
        year: release.date ? parseInt(release.date.split('-')[0]) : null,
        verificationUrl: `https://musicbrainz.org/release/${release.id}`,
        metadata: {
          country: release.country,
          releaseGroup: release['release-group']?.id,
        },
      }));

      // Also get recordings (songs)
      const recordingsResponse = await mbFetch(`/recording?artist=${artistId}&limit=100`);
      
      const recordingCredits = (recordingsResponse.recordings || []).map((recording: MusicBrainzRecording) => ({
        sourceId: recording.id,
        source: 'musicbrainz',
        creditType: 'single',
        title: recording.title,
        role: 'Artist',
        year: recording['first-release-date'] ? parseInt(recording['first-release-date'].split('-')[0]) : null,
        verificationUrl: `https://musicbrainz.org/recording/${recording.id}`,
        metadata: {},
      }));

      // Merge and dedupe by title
      const seenTitles = new Set(credits.map(c => c.title.toLowerCase()));
      for (const rc of recordingCredits) {
        if (!seenTitles.has(rc.title.toLowerCase())) {
          credits.push(rc);
          seenTitles.add(rc.title.toLowerCase());
        }
      }
    } else if (artistName) {
      // Search for artist
      console.log(`Searching MusicBrainz for: ${artistName}`);
      const searchResponse = await mbFetch(`/artist?query=${encodeURIComponent(artistName)}&limit=10`);
      
      allSearchResults = (searchResponse.artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        country: a.country,
        disambiguation: a.disambiguation,
      }));

      if (searchOnly) {
        return new Response(JSON.stringify({
          success: true,
          searchResults: allSearchResults.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            details: [a.country, a.disambiguation].filter(Boolean).join(' • '),
          })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (allSearchResults.length > 0) {
        artistData = allSearchResults[0];
        
        // Get releases for first result
        const releasesResponse = await mbFetch(`/release?artist=${artistData.id}&limit=100`);
        
        credits = (releasesResponse.releases || []).map((release: MusicBrainzRelease) => ({
          sourceId: release.id,
          source: 'musicbrainz',
          creditType: release['release-group']?.['primary-type']?.toLowerCase() || 'album',
          title: release.title,
          role: 'Artist',
          year: release.date ? parseInt(release.date.split('-')[0]) : null,
          verificationUrl: `https://musicbrainz.org/release/${release.id}`,
          metadata: {
            country: release.country,
            releaseGroup: release['release-group']?.id,
          },
        }));
      }
    }

    if (!artistData) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Artist not found',
        searchResults: allSearchResults,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Import credits to database
    if (credits.length > 0) {
      const creditsToInsert = credits.slice(0, 50).map(credit => ({
        user_id: user.id,
        source_id: credit.sourceId,
        source: credit.source,
        credit_type: credit.creditType,
        title: credit.title,
        role: credit.role,
        year: credit.year,
        verification_url: credit.verificationUrl,
        verified_at: new Date().toISOString(),
        metadata: credit.metadata,
      }));

      const { error: insertError } = await supabaseClient
        .from('verified_credits')
        .upsert(creditsToInsert, { 
          onConflict: 'user_id,source_id,source',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('Error inserting credits:', insertError);
      }

      // Update connected_platforms
      await supabaseClient
        .from('connected_platforms')
        .upsert({
          user_id: user.id,
          platform: 'musicbrainz',
          platform_username: artistData.name,
          platform_user_id: artistData.id,
          verified_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          platform_data: { artistType: artistData.type, country: artistData.country },
        }, { onConflict: 'user_id,platform' });
    }

    console.log(`Successfully imported ${credits.length} MusicBrainz credits for ${artistData.name}`);

    return new Response(JSON.stringify({
      success: true,
      artist: artistData,
      creditsImported: Math.min(credits.length, 50),
      searchResults: allSearchResults.length > 1 ? allSearchResults.slice(1) : [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('MusicBrainz error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
