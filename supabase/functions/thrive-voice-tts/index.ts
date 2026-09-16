// Thrive Voice TTS — synthesizes the agent's reply via Lovable AI Gateway
// (OpenAI gpt-4o-mini-tts). Returns base64 mp3, or { tts_fallback: true }
// so the client can fall back to browser SpeechSynthesis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 as b64encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Warm, professional default voice from gpt-4o-mini-tts.
const DEFAULT_VOICE = "alloy";
const TTS_MODEL = "openai/gpt-4o-mini-tts";

interface ReqBody {
  text: string;
  voice_id?: string; // legacy field name from old ElevenLabs client
  voice?: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map legacy ElevenLabs voice IDs → gpt-4o-mini-tts voices so old callers
// keep working without code changes.
const VOICE_ALIAS: Record<string, string> = {
  EXAVITQu4vr4xnSDxMaL: "alloy", // Sarah → warm neutral
  JBFqnCBsd6RMkjVDRZzb: "ash", // George
  TX3LPaxmHKxFdv7VOQHJ: "verse", // Liam
  Xb7hH8MSUJpSbSDYk0k2: "coral", // Alice
};
const VALID_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar",
]);

function resolveVoice(raw?: string): string {
  if (!raw) return DEFAULT_VOICE;
  if (VALID_VOICES.has(raw)) return raw;
  return VOICE_ALIAS[raw] || DEFAULT_VOICE;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    // Auth — keep TTS gated to signed-in users.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "missing_auth" }, 401);
    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "invalid_auth" }, 401);

    const body = (await req.json()) as ReqBody;
    const text = (body?.text || "").trim();
    if (!text) return jsonResponse({ error: "missing_text" }, 400);
    // Cap reply length so we don't burn credits on huge bodies.
    const speakText = text.length > 1200 ? text.slice(0, 1200) : text;

    if (!LOVABLE_API_KEY) {
      return jsonResponse({ tts_fallback: true, tts_error: "lovable_ai_not_configured" });
    }

    const voice = resolveVoice(body.voice || body.voice_id);

    try {
      const ttsResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: speakText,
          voice,
          response_format: "mp3",
        }),
      });
      if (!ttsResp.ok) {
        const err = await ttsResp.text();
        console.error("TTS failed", ttsResp.status, err);
        if (ttsResp.status === 429) {
          return jsonResponse({ tts_fallback: true, tts_error: "rate_limited" });
        }
        if (ttsResp.status === 402) {
          return jsonResponse({ tts_fallback: true, tts_error: "ai_credits_exhausted" });
        }
        return jsonResponse({ tts_fallback: true, tts_error: `tts_${ttsResp.status}` });
      }
      const audioBuf = new Uint8Array(await ttsResp.arrayBuffer());
      return jsonResponse({
        ok: true,
        audio_base64: b64encode(audioBuf),
        audio_mime: "audio/mpeg",
      });
    } catch (e) {
      console.error("TTS exception", e);
      return jsonResponse({ tts_fallback: true, tts_error: "tts_network_error" });
    }
  } catch (e) {
    console.error("voice-tts fatal", e);
    return jsonResponse(
      { error: "internal", detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
