// Temporary music generation endpoint for the YC product video.
// Calls ElevenLabs Music API and returns raw MP3 bytes.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) return new Response("missing key", { status: 500 });
    const { prompt, duration_ms } = await req.json();
    const r = await fetch("https://api.elevenlabs.io/v1/music/compose", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, music_length_ms: duration_ms ?? 180000 }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(`elevenlabs ${r.status}: ${t}`, { status: 500 });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
