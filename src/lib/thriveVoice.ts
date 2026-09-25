// Kretopia Voice — push-to-talk client helper for the "Talk to Kreto"
// agent (ThriveAgentFab.tsx). The search bar's own mic (useVoiceSearch.ts)
// used to route through this same file but now runs entirely client-side
// via the browser's SpeechRecognition API instead — no server round-trip,
// so it works instantly for anonymous visitors without depending on
// whether thrive-voice-turn accepts guest calls (see the "GUEST MIC
// UNLOCK" note below: that's still an open question server-side, and this
// file's stopAndSend()/synthesizeReply() still matter for the full agent,
// which does legitimately want a session for its per-account usage/credit
// tracking). Don't wire search back through this module — see
// useVoiceSearch.ts's own header comment for the full reasoning.
// Pipeline (split):
//   stopAndSend()       → POST audio to thrive-voice-turn → returns {transcript}
//   client agent path   → feeds transcript through the existing chat agent so
//                         every tool/automation (talent finder, quote, invoice,
//                         video call, memory…) fires exactly like text input
//   synthesizeReply()   → POST reply text to thrive-voice-tts → returns audio
//                         (or tts_fallback so we use browser SpeechSynthesis)
//
// v2 changes:
// 1. GUEST MIC UNLOCK — stopAndSend() no longer returns an early "please
//    sign in" error before even attempting the call. It still reads the
//    session and attaches a bearer token when one exists (so signed-in
//    users keep their normal tier/usage tracking), but a missing session
//    no longer blocks the request client-side; the Authorization header is
//    simply omitted for guests.
//    IMPORTANT — I can only control the client side of this from here.
//    Whether a guest's request actually succeeds depends on how the
//    thrive-voice-turn Edge Function itself is configured server-side
//    (specifically: whether it has `verify_jwt = false` / handles a null
//    user for its free-tier usage-cap logic, given the response shape
//    already includes per-user `usage: { used, cap, tier }`). I don't have
//    access to that function's source or its deploy config in this
//    conversation, so I can't confirm it accepts anonymous calls — I've
//    added a specific, honest fallback message below for the case where
//    the backend still rejects a guest request with 401, instead of
//    leaving that case to fall through to a generic error.
// 2. BRANDING — "Thrive" renamed to "Kretopia" everywhere it was
//    user-facing/cosmetic (this header comment, and the sign-in message —
//    which the guest-unlock above makes dead code, since it never fires
//    for a missing session anymore; left removed rather than translated).
//    NOT renamed: `thrive-voice-turn` / `thrive-voice-tts` in VOICE_URL /
//    TTS_URL. Those are literal Supabase Edge Function endpoint paths —
//    renaming them here only works if the deployed functions themselves
//    have also been renamed to kretopia-voice-turn/kretopia-voice-tts. I
//    have no evidence they have; renaming just the client-side string
//    would 404 every voice call. Tell me if the functions were renamed on
//    the backend and I'll update these in the same place.
// 3. AUDIO QUALITY — explicit sampleRate/channelCount constraints on the
//    mic capture (48kHz, mono — mono is the right choice for speech/STT,
//    not a quality compromise, and halves the bandwidth) and an explicit
//    audioBitsPerSecond on the MediaRecorder so Opus encodes at a
//    consistent, decent bitrate for voice rather than whatever the
//    browser's own default happens to be.

import { supabase } from "@/integrations/supabase/client";

const VOICE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/thrive-voice-turn`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/thrive-voice-tts`;

export interface VoiceTurnResult {
  ok: true;
  transcript: string;
  usage?: { used: number; cap: number; tier: string };
}

export interface VoiceTurnError {
  ok: false;
  code: string;
  message: string;
  transcript?: string;
  used?: number;
  cap?: number;
  tier?: string;
}

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let chunks: BlobPart[] = [];
let currentAudio: HTMLAudioElement | null = null;

export function isRecording() {
  return activeRecorder?.state === "recording";
}

export async function startRecording(): Promise<void> {
  if (activeRecorder) throw new Error("Already recording");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported on this device");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Explicit quality hints rather than leaving it to browser defaults:
      // 48kHz is the standard high-quality rate Opus expects, and mono is
      // the right choice for a single speaker (not a downgrade — it halves
      // the encoded size with no loss for speech/STT).
      sampleRate: 48000,
      channelCount: 1,
    },
  });
  activeStream = stream;
  chunks = [];
  const mime =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    // 128kbps is comfortably above what Opus needs for clean speech —
    // keeps encoding consistent instead of drifting with whatever
    // bitrate the browser's own default picks.
    audioBitsPerSecond: 128000,
  });
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start(250);
  activeRecorder = rec;
}

function teardown() {
  try {
    activeStream?.getTracks().forEach((t) => t.stop());
  } catch { /* ignore */ }
  activeRecorder = null;
  activeStream = null;
  chunks = [];
}

export function cancelRecording() {
  try {
    activeRecorder?.stop();
  } catch { /* ignore */ }
  teardown();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Stop recording and POST the audio to thrive-voice-turn for STT + tier-gating.
 * Returns the verbatim transcript only — caller is responsible for routing it
 * through the agent (so every tool runs) and then calling synthesizeReply().
 *
 * Open to guests: no session is required to attempt this call. A bearer
 * token is attached when one exists so signed-in users keep their normal
 * usage tracking; it's simply omitted otherwise. See the guest-unlock note
 * in the file header for what this can't guarantee server-side.
 */
export async function stopAndSend(): Promise<VoiceTurnResult | VoiceTurnError> {
  const rec = activeRecorder;
  if (!rec) {
    return { ok: false, code: "not_recording", message: "Nothing to send." };
  }
  const stopped: Blob = await new Promise((resolve) => {
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      resolve(blob);
    };
    try { rec.stop(); } catch { resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); }
  });
  teardown();

  if (stopped.size < 800) {
    return { ok: false, code: "too_short", message: "Hold the mic and speak — that was too short." };
  }

  const audio_base64 = await blobToBase64(stopped);

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let resp: Response;
  try {
    resp = await fetch(VOICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ audio_base64, mime_type: stopped.type || "audio/webm" }),
    });
  } catch (e) {
    return { ok: false, code: "network", message: e instanceof Error ? e.message : "Network error" };
  }

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok || data?.error) {
    // Guest request rejected by the function itself (see file header —
    // this is the case I can't fix from the client alone).
    if (!token && resp.status === 401) {
      return {
        ok: false,
        code: "guest_auth_required",
        message: "Voice isn't available for guests on this server yet — sign in to use your mic.",
      };
    }
    if (data?.error === "voice_daily_limit") {
      return {
        ok: false,
        code: "voice_daily_limit",
        message: `You've used today's free voice minutes. Upgrade for more.`,
        transcript: data.transcript,
        used: data.used,
        cap: data.cap,
        tier: data.tier,
      };
    }
    if (data?.error === "no_speech_detected") {
      return { ok: false, code: "no_speech", message: "Didn't catch that — try speaking clearly into the mic." };
    }
    return {
      ok: false,
      code: data?.error || "unknown",
      message: data?.error === "rate_limited"
        ? "Slow down a sec — try again in a moment."
        : data?.error === "ai_credits_exhausted"
          ? "Kreto Voice is out of credits this month."
          : "Voice turn failed. Try again.",
      transcript: data?.transcript,
    };
  }

  return { ok: true, transcript: data.transcript, usage: data.usage };
}

/** Synthesize the agent's reply via ElevenLabs; falls back to browser TTS.
 *  Also open to guests — no session required, same reasoning as
 *  stopAndSend(). Without a session, playback falls straight to the
 *  browser's own SpeechSynthesis (that path never needed a token). */
export async function synthesizeReply(text: string): Promise<{ audioUrl: string | null }> {
  const trimmed = (text || "").trim();
  if (!trimmed) return { audioUrl: null };

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    speakBrowser(trimmed);
    return { audioUrl: null };
  }

  try {
    const resp = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ text: trimmed }),
    });
    const data = await resp.json().catch(() => ({}));
    if (data?.audio_base64) {
      const url = `data:${data.audio_mime || "audio/mpeg"};base64,${data.audio_base64}`;
      playAudio(url);
      return { audioUrl: url };
    }
    // Fallback (no key, free-tier blocked, network error, etc.)
    speakBrowser(trimmed);
    return { audioUrl: null };
  } catch (e) {
    console.warn("TTS request failed, falling back to browser TTS", e);
    speakBrowser(trimmed);
    return { audioUrl: null };
  }
}

/** Speak via browser SpeechSynthesis — fallback when ElevenLabs is unavailable. */
function speakBrowser(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1.0;
    u.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|google.*us/i.test(v.name)) ||
      voices.find((v) => /en[-_](US|GB)/i.test(v.lang)) ||
      voices[0];
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("browser TTS failed", e);
  }
}

export function playAudio(url: string): HTMLAudioElement {
  stopPlayback();
  const audio = new Audio(url);
  currentAudio = audio;
  audio.play().catch((e) => console.warn("voice playback failed", e));
  return audio;
}

export function stopPlayback() {
  try {
    currentAudio?.pause();
    currentAudio = null;
  } catch { /* ignore */ }
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch { /* ignore */ }
}