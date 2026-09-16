import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZXRoYW5hdWd1c3RlIiwiYSI6ImNtZzhvbDk0dzAwaHYycnB6eWp4Zjh2OHAifQ.4uCSa5SdtxZAnC2Xvx6V5w';

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&types=place,locality,region,country&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j.features?.[0];
  if (!f?.center) return null;
  return { lng: f.center[0], lat: f.center[1] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mode, location, user_id } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Single geocode (called from profile save)
    if (mode === 'single' || (location && user_id)) {
      if (!location || typeof location !== 'string') {
        return new Response(JSON.stringify({ error: 'location required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const coords = await geocode(location);
      if (!coords) return new Response(JSON.stringify({ ok: false, reason: 'not_found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (user_id) {
        await supabase.from('profiles').update({ latitude: coords.lat, longitude: coords.lng }).eq('user_id', user_id);
      }
      return new Response(JSON.stringify({ ok: true, ...coords }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Backfill mode (admin)
    if (mode === 'backfill') {
      const { data: rows } = await supabase
        .from('profiles')
        .select('user_id, location')
        .or('latitude.is.null,longitude.is.null')
        .not('location', 'is', null)
        .limit(200);

      let success = 0, failed = 0;
      for (const row of rows ?? []) {
        if (!row.location || row.location.length < 2) { failed++; continue; }
        const coords = await geocode(row.location);
        if (coords) {
          await supabase.from('profiles').update({ latitude: coords.lat, longitude: coords.lng }).eq('user_id', row.user_id);
          success++;
        } else {
          failed++;
        }
        await new Promise(r => setTimeout(r, 80)); // rate limit
      }
      return new Response(JSON.stringify({ ok: true, success, failed, processed: (rows ?? []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
