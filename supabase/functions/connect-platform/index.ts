import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Platform OAuth configurations
const PLATFORM_CONFIGS: Record<string, {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}> = {
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['user-read-private', 'user-read-email', 'user-top-read'],
    clientIdEnv: 'SPOTIFY_CLIENT_ID',
    clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/userinfo.profile'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
    clientIdEnv: 'INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
  },
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

    const requestBody = await req.json();
    const { action, platform, code, redirectUri, state: clientState, query, artistId, artistName, spotifyType } = requestBody;

    if (!platform || !PLATFORM_CONFIGS[platform]) {
      return new Response(JSON.stringify({ error: 'Invalid platform' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = PLATFORM_CONFIGS[platform];
    const clientId = Deno.env.get(config.clientIdEnv);
    const clientSecret = Deno.env.get(config.clientSecretEnv);

    if (!clientId || !clientSecret) {
      console.log(`Missing credentials for ${platform}`);
      return new Response(JSON.stringify({ 
        error: `${platform} integration not configured`,
        details: 'API credentials are not set up yet'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Get OAuth URL
    if (action === 'getAuthUrl') {
      // Use client-provided state if available, otherwise generate one
      // The client state is used for CSRF protection and validated on callback
      const state = clientState || btoa(JSON.stringify({ userId: user.id, platform, timestamp: Date.now() }));
      const scopeString = config.scopes.join(platform === 'tiktok' ? ',' : ' ');
      
      let authUrl: string;
      
      if (platform === 'tiktok') {
        // TikTok uses different parameter format
        authUrl = `${config.authUrl}?client_key=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopeString)}`;
      } else {
        authUrl = `${config.authUrl}?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopeString)}`;
      }
      
      // Platform-specific params
      if (platform === 'youtube') {
        authUrl += '&access_type=offline&prompt=consent';
      }
      if (platform === 'spotify') {
        authUrl += '&show_dialog=true';
      }

      console.log(`Generated OAuth URL for ${platform} with state length: ${state.length}`);
      return new Response(JSON.stringify({ authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Exchange code for tokens
    if (action === 'exchangeCode') {
      if (!code || !redirectUri) {
        return new Response(JSON.stringify({ error: 'Missing code or redirectUri' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Exchange code for tokens
      let tokenBody: URLSearchParams | string;
      let tokenHeaders: Record<string, string>;
      
      if (platform === 'tiktok') {
        // TikTok uses different parameter names and JSON body
        tokenBody = JSON.stringify({
          client_key: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        });
        tokenHeaders = {
          'Content-Type': 'application/json',
        };
      } else {
        tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString();
        tokenHeaders = {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(platform === 'spotify' ? {
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
          } : {}),
        };
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: tokenBody,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`Token exchange failed for ${platform}:`, errorText);
        return new Response(JSON.stringify({ error: 'Token exchange failed', details: errorText }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenResponse.json();
      console.log(`Got tokens for ${platform}:`, Object.keys(tokens));

      // Fetch platform-specific user data and metrics
      const platformData = await fetchPlatformData(platform, tokens.access_token);

      // Store in database
      const { error: upsertError } = await supabase
        .from('connected_platforms')
        .upsert({
          user_id: user.id,
          platform,
          platform_user_id: platformData.userId,
          platform_username: platformData.username,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expires_in 
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          platform_data: platformData.metrics,
          last_synced_at: new Date().toISOString(),
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });

      if (upsertError) {
        console.error('Failed to store platform connection:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to store connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update profile verification status
      const verificationField = `${platform}_verified`;
      await supabase
        .from('profiles')
        .update({ 
          [verificationField]: true,
          [`${platform}_${platform === 'spotify' ? 'listeners' : 'followers'}`]: platformData.metrics.followers || platformData.metrics.monthlyListeners || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      // Import verified credits if available
      if (platformData.credits && platformData.credits.length > 0) {
        await importVerifiedCredits(supabase, user.id, platform, platformData.credits);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        platform,
        platformData: platformData.metrics,
        creditsImported: platformData.credits?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Refresh platform data
    if (action === 'refresh') {
      const { data: connection } = await supabase
        .from('connected_platforms')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', platform)
        .single();

      if (!connection) {
        return new Response(JSON.stringify({ error: 'Platform not connected' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TODO: Refresh token if expired
      const platformData = await fetchPlatformData(platform, connection.access_token);

      await supabase
        .from('connected_platforms')
        .update({
          platform_data: platformData.metrics,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      return new Response(JSON.stringify({ 
        success: true, 
        platformData: platformData.metrics,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Disconnect platform
    if (action === 'disconnect') {
      await supabase
        .from('connected_platforms')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', platform);

      const verificationField = `${platform}_verified`;
      await supabase
        .from('profiles')
        .update({ [verificationField]: false })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Search Spotify (artists, shows, and episodes)
    if (action === 'searchArtist' && platform === 'spotify') {
      if (!query) {
        return new Response(JSON.stringify({ error: 'Missing search query' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      try {
        // Get client credentials token
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: 'grant_type=client_credentials',
        });
        
        if (!tokenRes.ok) {
          throw new Error('Failed to get Spotify access token');
        }
        
        const tokenData = await tokenRes.json();
        
        // Do TWO searches: one prioritizing shows/podcasts, another for artists/episodes
        const showSearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=10&market=US`;
        const generalSearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist,episode&limit=10&market=US`;
        
        const [showSearchRes, generalSearchRes] = await Promise.all([
          fetch(showSearchUrl, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }),
          fetch(generalSearchUrl, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }),
        ]);
        
        if (!showSearchRes.ok || !generalSearchRes.ok) {
          throw new Error('Spotify search failed');
        }
        
        const [showSearchData, generalSearchData] = await Promise.all([
          showSearchRes.json(),
          generalSearchRes.json(),
        ]);
        
        // Combine results - PRIORITIZE SHOWS (podcasts) first
        const results: any[] = [];
        const seenIds = new Set<string>();
        
        // Add shows (podcasts) FIRST - prioritized
        (showSearchData.shows?.items || []).forEach((show: any) => {
          if (show && !seenIds.has(show.id)) {
            seenIds.add(show.id);
            results.push({
              id: show.id,
              name: show.name,
              image: show.images?.[0]?.url,
              type: 'show',
              details: `Podcast • ${show.publisher || 'Unknown'} • ${show.total_episodes || 0} episodes`,
              publisher: show.publisher,
              url: show.external_urls?.spotify,
              totalEpisodes: show.total_episodes,
            });
          }
        });
        
        // Add artists
        (generalSearchData.artists?.items || []).forEach((artist: any) => {
          if (artist && !seenIds.has(artist.id)) {
            seenIds.add(artist.id);
            results.push({
              id: artist.id,
              name: artist.name,
              image: artist.images?.[0]?.url,
              type: 'artist',
              details: artist.genres?.slice(0, 2).join(', ') || `${(artist.followers?.total || 0).toLocaleString()} followers`,
              url: artist.external_urls?.spotify,
              followers: artist.followers?.total || 0,
            });
          }
        });
        
        // Add episodes (podcast appearances)
        (generalSearchData.episodes?.items || []).forEach((episode: any) => {
          if (episode && !seenIds.has(episode.id)) {
            seenIds.add(episode.id);
            results.push({
              id: episode.id,
              name: episode.name,
              image: episode.images?.[0]?.url,
              type: 'episode',
              details: `Episode on ${episode.show?.name || 'Podcast'} • ${episode.release_date || ''}`,
              showName: episode.show?.name,
              showId: episode.show?.id,
              url: episode.external_urls?.spotify,
              releaseDate: episode.release_date,
              duration: episode.duration_ms,
            });
          }
        });
        
        console.log(`Spotify search for "${query}" found: ${showSearchData.shows?.items?.length || 0} shows, ${generalSearchData.artists?.items?.length || 0} artists, ${generalSearchData.episodes?.items?.length || 0} episodes`);
        
        return new Response(JSON.stringify({
          success: true,
          results,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('Spotify search error:', e);
        return new Response(JSON.stringify({ 
          error: 'Spotify search unavailable',
          details: e.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Action: Find podcast guest appearances by searching episodes mentioning user's name
    if (action === 'findGuestAppearances' && platform === 'spotify') {
      const guestName = requestBody.guestName;
      if (!guestName) {
        return new Response(JSON.stringify({ error: 'Missing guestName' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      try {
        // Get client credentials token
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: 'grant_type=client_credentials',
        });
        
        if (!tokenRes.ok) throw new Error('Failed to get Spotify access token');
        const tokenData = await tokenRes.json();
        
        // Search specifically for episodes mentioning the guest name
        const searchQueries = [
          `"${guestName}"`, // Exact name match
          `${guestName} interview`,
          `${guestName} guest`,
          `featuring ${guestName}`,
        ];
        
        const allEpisodes: any[] = [];
        const seenIds = new Set<string>();
        
        for (const searchQuery of searchQueries) {
          const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=episode&limit=20`;
          
          const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
          });
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            
            (searchData.episodes?.items || []).forEach((episode: any) => {
              if (!seenIds.has(episode.id)) {
                seenIds.add(episode.id);
                
                // Check if the episode title or description actually contains the name
                const nameInTitle = episode.name?.toLowerCase().includes(guestName.toLowerCase());
                const nameInDescription = episode.description?.toLowerCase().includes(guestName.toLowerCase());
                
                if (nameInTitle || nameInDescription) {
                  allEpisodes.push({
                    id: episode.id,
                    name: episode.name,
                    image: episode.images?.[0]?.url,
                    type: 'episode',
                    details: `${episode.show?.name || 'Podcast'} • ${episode.release_date || ''}`,
                    showName: episode.show?.name,
                    showId: episode.show?.id,
                    showImage: episode.show?.images?.[0]?.url,
                    url: episode.external_urls?.spotify,
                    releaseDate: episode.release_date,
                    duration: episode.duration_ms,
                    confidence: nameInTitle ? 'high' : 'medium',
                  });
                }
              }
            });
          }
        }
        
        // Sort by confidence and release date
        allEpisodes.sort((a, b) => {
          if (a.confidence !== b.confidence) {
            return a.confidence === 'high' ? -1 : 1;
          }
          return new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime();
        });
        
        console.log(`Found ${allEpisodes.length} potential guest appearances for "${guestName}"`);
        
        return new Response(JSON.stringify({
          success: true,
          guestAppearances: allEpisodes.slice(0, 30), // Limit to 30 results
          totalFound: allEpisodes.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('Guest appearance search error:', e);
        return new Response(JSON.stringify({ 
          error: 'Failed to search for guest appearances',
          details: e.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Action: Import Spotify credits for a specific artist, show (podcast), or episode
    if (action === 'importSpotifyCredits') {
      if (!artistId) {
        return new Response(JSON.stringify({ error: 'Missing artistId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      try {
        // Get client credentials token
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: 'grant_type=client_credentials',
        });
        
        if (!tokenRes.ok) throw new Error('Failed to get Spotify access token');
        const tokenData = await tokenRes.json();
        
        const credits: any[] = [];
        
        // Handle different Spotify content types
        if (spotifyType === 'show') {
          // Fetch podcast show and its episodes
          const showRes = await fetch(
            `https://api.spotify.com/v1/shows/${artistId}`,
            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
          );
          
          if (!showRes.ok) throw new Error('Failed to fetch show');
          const showData = await showRes.json();
          
          // Fetch episodes
          const episodesRes = await fetch(
            `https://api.spotify.com/v1/shows/${artistId}/episodes?limit=50`,
            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
          );
          
          if (episodesRes.ok) {
            const episodesData = await episodesRes.json();
            
            (episodesData.items || []).forEach((ep: any) => {
              credits.push({
                sourceId: ep.id,
                creditType: 'podcast',
                title: ep.name,
                role: 'Host',
                year: ep.release_date ? parseInt(ep.release_date.substring(0, 4)) : undefined,
                metadata: {
                  imageUrl: ep.images?.[0]?.url || showData.images?.[0]?.url,
                  showName: showData.name,
                  releaseDate: ep.release_date,
                  duration: ep.duration_ms,
                  spotifyUrl: ep.external_urls?.spotify,
                },
                verificationUrl: ep.external_urls?.spotify,
              });
            });
          }
          
          // Also add the show itself as a credit
          credits.unshift({
            sourceId: `show-${artistId}`,
            creditType: 'podcast',
            title: showData.name,
            role: 'Podcast Host',
            year: undefined,
            metadata: {
              imageUrl: showData.images?.[0]?.url,
              publisher: showData.publisher,
              totalEpisodes: showData.total_episodes,
              spotifyUrl: showData.external_urls?.spotify,
              description: showData.description?.substring(0, 200),
            },
            verificationUrl: showData.external_urls?.spotify,
          });
          
          console.log(`Imported ${credits.length} podcast credits for show "${showData.name}"`);
          
        } else if (spotifyType === 'episode') {
          // Single episode appearance
          const episodeRes = await fetch(
            `https://api.spotify.com/v1/episodes/${artistId}`,
            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
          );
          
          if (!episodeRes.ok) throw new Error('Failed to fetch episode');
          const episodeData = await episodeRes.json();
          
          credits.push({
            sourceId: artistId,
            creditType: 'podcast',
            title: episodeData.name,
            role: 'Guest',
            year: episodeData.release_date ? parseInt(episodeData.release_date.substring(0, 4)) : undefined,
            metadata: {
              imageUrl: episodeData.images?.[0]?.url,
              showName: episodeData.show?.name,
              releaseDate: episodeData.release_date,
              duration: episodeData.duration_ms,
              spotifyUrl: episodeData.external_urls?.spotify,
            },
            verificationUrl: episodeData.external_urls?.spotify,
          });
          
          console.log(`Imported episode credit: "${episodeData.name}"`);
          
        } else {
          // Default: Artist - fetch albums
          const albumsRes = await fetch(
            `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`,
            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
          );
          
          if (!albumsRes.ok) throw new Error('Failed to fetch albums');
          const albumsData = await albumsRes.json();
          
          (albumsData.items || []).forEach((album: any) => {
            credits.push({
              sourceId: album.id,
              creditType: album.album_type === 'single' ? 'single' : 'album',
              title: album.name,
              role: 'Artist',
              year: album.release_date ? parseInt(album.release_date.substring(0, 4)) : undefined,
              metadata: {
                imageUrl: album.images?.[0]?.url,
                totalTracks: album.total_tracks,
                releaseDate: album.release_date,
                spotifyUrl: album.external_urls?.spotify,
              },
              verificationUrl: album.external_urls?.spotify,
            });
          });
          
          console.log(`Imported ${credits.length} album credits for artist "${artistName}"`);
        }
        
        // Import credits to database
        for (const credit of credits) {
          await supabase
            .from('verified_credits')
            .upsert({
              user_id: user.id,
              source: 'spotify',
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
        
        return new Response(JSON.stringify({
          success: true,
          creditsImported: credits.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('Spotify import error:', e);
        return new Response(JSON.stringify({ 
          error: 'Failed to import Spotify credits',
          details: e.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Connect platform error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fetch platform-specific data
async function fetchPlatformData(platform: string, accessToken: string): Promise<{
  userId: string;
  username: string;
  metrics: Record<string, any>;
  credits?: Array<{
    sourceId: string;
    creditType: string;
    title: string;
    role: string;
    year?: number;
    metadata: Record<string, any>;
    verificationUrl?: string;
  }>;
}> {
  switch (platform) {
    case 'spotify':
      return await fetchSpotifyData(accessToken);
    case 'youtube':
      return await fetchYouTubeData(accessToken);
    case 'instagram':
      return await fetchInstagramData(accessToken);
    case 'tiktok':
      return await fetchTikTokData(accessToken);
    default:
      return { userId: '', username: '', metrics: {} };
  }
}

async function fetchSpotifyData(accessToken: string) {
  // Get user profile
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (!profileRes.ok) {
    const errorText = await profileRes.text();
    console.error('Spotify profile error:', profileRes.status, errorText);
    
    // Handle specific Spotify errors
    if (profileRes.status === 403) {
      throw new Error('Spotify app is in Development Mode. Please add your Spotify account email to the app allowlist in the Spotify Developer Dashboard.');
    }
    if (profileRes.status === 401) {
      throw new Error('Spotify authorization expired. Please try connecting again.');
    }
    throw new Error(`Spotify API error: ${profileRes.status}`);
  }
  
  const profile = await profileRes.json();

  // Get top artists (to show their discography/credits) - optional, don't fail if this errors
  let topArtists = { items: [] };
  try {
    const topArtistsRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (topArtistsRes.ok) {
      topArtists = await topArtistsRes.json();
    }
  } catch (e) {
    console.log('Could not fetch top artists:', e);
  }

  // If user is an artist, try to get their artist profile
  let artistData = null;
  let credits: any[] = [];
  
  // Search for artist with same name - optional, don't fail if this errors
  let searchResults = { artists: { items: [] } };
  try {
    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(profile.display_name || '')}&type=artist&limit=5`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (searchRes.ok) {
      searchResults = await searchRes.json();
    }
  } catch (e) {
    console.log('Could not search for artist:', e);
  }
  
  // Find matching artist (simple name match)
  const matchingArtist = searchResults.artists?.items?.find(
    (a: any) => a.name?.toLowerCase() === profile.display_name?.toLowerCase()
  );

  if (matchingArtist) {
    artistData = matchingArtist as any;
    
    // Get artist's albums as credits - optional, don't fail
    try {
      const albumsRes = await fetch(`https://api.spotify.com/v1/artists/${(matchingArtist as any).id}/albums?include_groups=album,single&limit=50`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (albumsRes.ok) {
        const albums = await albumsRes.json();
        
        credits = albums.items?.map((album: any) => ({
          sourceId: album.id,
          creditType: album.album_type === 'single' ? 'single' : 'album',
          title: album.name,
          role: 'Artist',
          year: album.release_date ? parseInt(album.release_date.substring(0, 4)) : undefined,
          metadata: {
            imageUrl: album.images?.[0]?.url,
            totalTracks: album.total_tracks,
            releaseDate: album.release_date,
            spotifyUrl: album.external_urls?.spotify,
          },
          verificationUrl: album.external_urls?.spotify,
        })) || [];
      }
    } catch (e) {
      console.log('Could not fetch artist albums:', e);
    }
  }

  const artistDataTyped = artistData as any;
  
  return {
    userId: profile.id,
    username: profile.display_name,
    metrics: {
      followers: artistDataTyped?.followers?.total || profile.followers?.total || 0,
      monthlyListeners: artistDataTyped?.popularity ? artistDataTyped.popularity * 10000 : null,
      profileUrl: profile.external_urls?.spotify,
      imageUrl: profile.images?.[0]?.url,
      isArtist: !!artistData,
      artistId: artistDataTyped?.id,
      genres: artistDataTyped?.genres || [],
    },
    credits,
  };
}

async function fetchYouTubeData(accessToken: string) {
  // Get user's channel
  const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const channelData = await channelRes.json();
  const channel = channelData.items?.[0];

  if (!channel) {
    return { userId: '', username: '', metrics: {} };
  }

  // Get recent videos as credits
  const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&maxResults=50&order=date&type=video`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const videosData = await videosRes.json();

  const credits = videosData.items?.map((video: any) => ({
    sourceId: video.id.videoId,
    creditType: 'music_video',
    title: video.snippet.title,
    role: 'Creator',
    year: video.snippet.publishedAt ? parseInt(video.snippet.publishedAt.substring(0, 4)) : undefined,
    metadata: {
      thumbnailUrl: video.snippet.thumbnails?.high?.url,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
    },
    verificationUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
  })) || [];

  return {
    userId: channel.id,
    username: channel.snippet.title,
    metrics: {
      subscribers: parseInt(channel.statistics.subscriberCount) || 0,
      totalViews: parseInt(channel.statistics.viewCount) || 0,
      videoCount: parseInt(channel.statistics.videoCount) || 0,
      profileUrl: `https://www.youtube.com/channel/${channel.id}`,
      imageUrl: channel.snippet.thumbnails?.high?.url,
    },
    credits,
  };
}

async function fetchTikTokData(accessToken: string) {
  // Get user info with stats
  const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const userData = await userRes.json();
  const user = userData.data?.user;

  if (!user) {
    return { userId: '', username: '', metrics: {} };
  }

  // Get recent videos as credits
  let credits: any[] = [];
  try {
    const videosRes = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    });
    const videosData = await videosRes.json();
    
    credits = videosData.data?.videos?.map((video: any) => ({
      sourceId: video.id,
      creditType: 'tiktok_video',
      title: video.title || 'TikTok Video',
      role: 'Creator',
      year: video.create_time ? new Date(video.create_time * 1000).getFullYear() : undefined,
      metadata: {
        thumbnailUrl: video.cover_image_url,
        duration: video.duration,
        views: video.view_count,
        likes: video.like_count,
        comments: video.comment_count,
        shares: video.share_count,
      },
      verificationUrl: video.share_url,
    })) || [];
  } catch (e) {
    console.error('Failed to fetch TikTok videos:', e);
  }

  return {
    userId: user.open_id,
    username: user.display_name,
    metrics: {
      followers: user.follower_count || 0,
      following: user.following_count || 0,
      likes: user.likes_count || 0,
      videoCount: user.video_count || 0,
      isVerified: user.is_verified,
      profileUrl: user.profile_deep_link,
      imageUrl: user.avatar_url,
      bio: user.bio_description,
    },
    credits,
  };
}

async function fetchInstagramData(accessToken: string) {
  // Instagram Basic Display API
  const userRes = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`);
  const userData = await userRes.json();

  return {
    userId: userData.id,
    username: userData.username,
    metrics: {
      mediaCount: userData.media_count || 0,
      accountType: userData.account_type,
      profileUrl: `https://instagram.com/${userData.username}`,
    },
    credits: [],
  };
}

async function importVerifiedCredits(
  supabase: any,
  userId: string,
  source: string,
  credits: any[]
) {
  for (const credit of credits) {
    await supabase
      .from('verified_credits')
      .upsert({
        user_id: userId,
        source,
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
}
