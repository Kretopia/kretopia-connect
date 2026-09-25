import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceSearchStatus =
  | "unsupported"
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "denied"
  | "error";

interface UseVoiceSearchOptions {
  onTranscript: (text: string) => void;
}

// The Web Speech API isn't part of TypeScript's standard DOM lib -- these
// are a minimal local shape for the handful of members actually used
// here, not the ambient global (avoids depending on an extra @types
// package, and avoids colliding with it if one is ever added).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Voice input for the search bar — fully client-side and anonymous.
 *
 * This used to reuse the same push-to-talk pipeline as the authenticated
 * "Talk to Kreto" agent (src/lib/thriveVoice.ts): record -> upload to
 * thrive-voice-turn -> server transcribes. That endpoint requires a
 * signed-in Supabase session (it's tied to per-account AI usage/credits,
 * which is correct for the full agent) — so for a signed-out visitor
 * typing into the landing hero or navbar search, every voice attempt
 * silently failed with "Please sign in", i.e. the mic looked broken.
 *
 * Search doesn't need the agent, tool-calling, or a spoken reply — just
 * text in the search box, as fast as possible, for anyone. The browser's
 * own SpeechRecognition API does exactly that: no server round-trip, no
 * auth, live incremental results. It manages its own internal audio
 * capture, so a *separate* getUserMedia() stream is opened purely to
 * drive the real audio-level waveform (VoiceWaveform) — recognition and
 * metering run side by side off one already-granted mic permission.
 *
 * Unsupported browsers (no SpeechRecognition — historically Firefox, and
 * some older WebViews) fall back to "unsupported": the mic button hides
 * and typed search keeps working, same as before.
 */
export function useVoiceSearch({ onTranscript }: UseVoiceSearchOptions) {
  const RecognitionCtor = getSpeechRecognitionCtor();
  const micSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const supported = !!RecognitionCtor && micSupported;

  const [status, setStatus] = useState<VoiceSearchStatus>(supported ? "idle" : "unsupported");
  const [level, setLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const mountedRef = useRef(true);

  const stopMetering = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const teardown = useCallback(() => {
    stopMetering();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* already stopped */ }
    }
    transcriptRef.current = "";
  }, [stopMetering]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Never keep listening in the background — tear down on unmount.
      teardown();
    };
  }, [teardown]);

  const startMetering = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (mountedRef.current) setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Metering is a visual nicety — if it fails, recognition still works.
    }
  }, []);

  /** Tears down and resolves whatever transcript was captured so far —
   *  called from recognition.onend, whether that end was a deliberate
   *  stop() or the browser's own silence/session timeout. Either way the
   *  mic session is over and the UI must not get stuck in "recording". */
  const finishRecording = useCallback(() => {
    stopMetering();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recognitionRef.current = null;
    if (!mountedRef.current) return;
    const transcript = transcriptRef.current.trim();
    transcriptRef.current = "";
    setStatus("idle");
    if (transcript) onTranscript(transcript);
  }, [onTranscript, stopMetering]);

  const start = useCallback(async () => {
    if (!supported || !RecognitionCtor) return;
    setErrorMessage(null);
    setStatus("requesting");
    transcriptRef.current = "";

    // A real mic stream for the waveform meter only — recognition itself
    // runs through the browser's own audio pipeline and never touches
    // this stream or sends it anywhere.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      if (!mountedRef.current) return;
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        setErrorMessage("Microphone access was denied. You can still type your search.");
      } else if (name === "NotFoundError") {
        setStatus("error");
        setErrorMessage("No microphone found. You can still type your search.");
      } else {
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "Couldn't access the microphone.");
      }
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
      }
      if (finalChunk) transcriptRef.current += finalChunk;
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) return;
      // Routine, not real errors: silence timing out, or our own abort()/
      // stop() — onend (always wired below) handles winding down either way.
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus("denied");
        setErrorMessage("Microphone access was denied. You can still type your search.");
      } else if (event.error === "network") {
        setStatus("error");
        setErrorMessage("Voice search needs a network connection. You can still type your search.");
      } else {
        setStatus("error");
        setErrorMessage("Voice search hiccupped — try again or type your search.");
      }
    };

    // Always resolves the session, regardless of *why* it ended (manual
    // stop, or the browser's own timeout) — the one place that finalizes
    // status, so it can never get stuck showing "recording".
    recognition.onend = finishRecording;

    recognitionRef.current = recognition;
    streamRef.current = stream;
    try {
      recognition.start();
    } catch {
      // Vanishingly rare (e.g. a start() while already starting) — surface
      // as a normal error rather than leaving the button dead.
      if (mountedRef.current) {
        setStatus("error");
        setErrorMessage("Couldn't start voice search — try again.");
      }
      stream.getTracks().forEach((t) => t.stop());
      recognitionRef.current = null;
      streamRef.current = null;
      return;
    }
    setStatus("recording");
    startMetering(stream);
  }, [supported, RecognitionCtor, startMetering, finishRecording]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    setStatus("processing");
    try {
      recognitionRef.current.stop();
    } catch {
      finishRecording();
    }
  }, [finishRecording]);

  const cancel = useCallback(() => {
    transcriptRef.current = "";
    teardown();
    setStatus("idle");
    setErrorMessage(null);
  }, [teardown]);

  const dismissError = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { supported, status, level, errorMessage, start, stop, cancel, dismissError };
}
