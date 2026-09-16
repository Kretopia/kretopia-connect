// Thrive Voice — push-to-talk client helper.
// Pipeline (split):
//   stopAndSend()       → POST audio to thrive-voice-turn → returns {transcript}
//   client agent path   → feeds transcript through the existing chat agent so
//                         every tool/automation (talent finder, quote, invoice,
//                         video call, memory…) fires exactly like text input
//   synthesizeReply()   → POST reply text to thrive-voice-tts → returns audio
//                         (or tts_fallback so we use browser SpeechSynthesis)

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

/** The live MediaStream while recording — for callers that want to attach
 *  their own AnalyserNode for a real audio-level visualization (see
 *  useVoiceSearch.ts). Null when not recording. */
export function getActiveStream(): MediaStream | null {
  return activeStream;
}

export async function startRecording(): Promise<void> {
  if (activeRecorder) throw new Error("Already recording");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported on this device");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  activeStream = stream;
  chunks = [];
  const mime =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime });
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
  if (!token) {
    return { ok: false, code: "auth", message: "Please sign in to talk to Thrive." };
  }

  let resp: Response;
  try {
    resp = await fetch(VOICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ audio_base64, mime_type: stopped.type || "audio/webm" }),
    });
  } catch (e) {
    return { ok: false, code: "network", message: e instanceof Error ? e.message : "Network error" };
  }

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok || data?.error) {
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

/** Synthesize the agent's reply via ElevenLabs; falls back to browser TTS. */
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
