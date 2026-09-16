import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording, stopAndSend, cancelRecording, getActiveStream, type VoiceTurnResult, type VoiceTurnError } from "@/lib/thriveVoice";

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

/**
 * Voice input for the search bar. Reuses the existing push-to-talk pipeline
 * (src/lib/thriveVoice.ts — record -> POST thrive-voice-turn -> transcript)
 * rather than a separate implementation, and adds a real, live audio-level
 * reading (RMS from an AnalyserNode, same technique as
 * SoundStageRoom.tsx's mic meter) so the waveform reflects actual mic input
 * instead of a generic looping animation.
 *
 * Permission is requested only inside start(), which only ever runs from a
 * user click — never on mount, never automatically.
 */
export function useVoiceSearch({ onTranscript }: UseVoiceSearchOptions) {
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const [status, setStatus] = useState<VoiceSearchStatus>(supported ? "idle" : "unsupported");
  const [level, setLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Never keep recording in the background — tear down on unmount.
      stopMetering();
      cancelRecording();
    };
  }, []);

  function stopMetering() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }

  function startMetering() {
    const stream = getActiveStream();
    if (!stream) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Metering is a visual nicety — if it fails, recording still works.
    }
  }

  const start = useCallback(async () => {
    if (!supported) return;
    setErrorMessage(null);
    setStatus("requesting");
    try {
      await startRecording();
      if (!mountedRef.current) return;
      setStatus("recording");
      startMetering();
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
    }
  }, [supported]);

  const stop = useCallback(async () => {
    stopMetering();
    setStatus("processing");
    const result: VoiceTurnResult | VoiceTurnError = await stopAndSend();
    if (!mountedRef.current) return;
    if (result.ok === false) {
      setStatus("error");
      setErrorMessage(result.message);
      return;
    }
    setStatus("idle");
    if (result.transcript?.trim()) onTranscript(result.transcript.trim());
  }, [onTranscript]);

  const cancel = useCallback(() => {
    stopMetering();
    cancelRecording();
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const dismissError = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { supported, status, level, errorMessage, start, stop, cancel, dismissError };
}
