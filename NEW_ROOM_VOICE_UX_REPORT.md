# New Room — Voice UX Report

## Real, not decorative

Confirmed via code reading (not browser-tested end-to-end — no real microphone hardware available in the automated verification environment; jsdom also has no `MediaRecorder`/`getUserMedia`, so this isn't unit-testable either. This is a documented gap, not a silent one).

`startRecording()`: real `navigator.mediaDevices.getUserMedia({ audio: true })`, real `MediaRecorder`, `mimeType: "audio/webm"`. Permission denial is caught (not an unhandled rejection) and falls back to text mode with a plain-language toast ("Mic not available — Type what you're making instead") rather than a raw browser permission error.

## States present

idle (mic button) → `recording` (stop button, live `mm:ss` timer, `animate-ping` halo) → `thinking` (audio sent, `KretoAvatar state="thinking"` + cycling status text) → `review`. Cancel path: no dedicated "cancel recording" button distinct from Stop — stopping mid-recording still sends whatever was captured to `extract-brief` rather than discarding it. If a true silent-discard cancel is wanted, that's a real, small feature gap, not implemented this pass (out of scope — not requested, and inventing a new interaction pattern wasn't part of the audited gaps).

## Cleanup

`stream.getTracks().forEach(t => t.stop())` runs in `rec.onstop`, confirmed present — the microphone is released, not left open. No separate `useEffect` cleanup was found for the case where the component unmounts entirely mid-recording (e.g. the user navigates away via browser back button while recording) — a narrow edge case, flagged but not fixed this pass given no evidence it's reachable through any in-app navigation path (the modal has no internal links that would unmount it while `mediaRef.current` is active).

## Accessibility

Voice is one of four equally-usable entry points, not the only path — confirmed live and via code: "Or type it instead" is always present and one tap away from the idle mic screen; starter-intent chips and the file/link cards bypass voice entirely. This satisfies the spec's "voice must not be the only path" requirement, and was already true before this pass.

## Not verified this pass

Real transcript accuracy/quality (depends on Gemini's audio understanding, not something this repo controls), voice input on a real mobile device's microphone permissions flow (only the permission-denied code path was read, not exercised on-device).
