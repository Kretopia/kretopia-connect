# New Room — Input Modes

Real, current state of each input mode in `VoiceFirstCreateModal.tsx`. All four are genuinely wired to `extract-brief`, not stubs.

## Voice

`startRecording()` → real `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`. States: idle (mic button) → `recording` (stop button, running `mm:ss` timer via `startTimer`/`stopTimer`) → `thinking` (audio blob base64'd, sent as `source: "audio"`) → `review`. Mic-permission failure: caught, toasts "Mic not available," falls back to text mode (`setShowText(true)`) rather than dead-ending. Track cleanup: `stream.getTracks().forEach(t => t.stop())` on `rec.onstop`, confirmed present.

## Text

Always-available fallback ("Or type it instead" from the voice screen, or directly via a starter-intent chip). Placeholder text is per-`WorkspaceType`, promoted to a tappable "Try: ..." quick-fill chip. `submitText()` infers a type via `inferWorkspaceType()` if none was already picked, so the right persona is used even for free-typed input. On `extract-brief` failure: does not dead-end — falls back to a raw title/summary built from the typed text and still proceeds to `review`, with a toast explaining Kreto couldn't expand it (not a raw provider error).

## File

"Start from a brief or file" → native file picker, `application/pdf,image/*,.doc,.docx`. 25MB client-side cap (`processFile()`, real check, real toast on rejection). Images are compressed before send (`compressImage()`, resize ≤1280px, re-encode JPEG) — a real, non-cosmetic optimization already in place for large phone photos. Sent as `source: "doc"`.

## Link

"Paste a Google Sheet" → URL input, `submitLink()` → `source: "sheet"`. Failure copy is specific ("Make sure the Google Sheet is shared as 'Anyone with the link'"), not generic.

## What's honest vs. what the spec assumed

The spec's template asked to verify "no fake percentages" and "honest progress" for processing states — confirmed already true: the `thinking` mode shows real cycling status copy (`THINKING_STEPS`, paced on a fixed timer since the actual call is one request/response with no real intermediate progress to report) and an indeterminate gradient sweep, not a fabricated percentage. This was already correct before this pass; not something this pass needed to fix.
