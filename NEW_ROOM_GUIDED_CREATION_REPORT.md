# New Room — Guided Creation Experience

## What changed

[`src/components/project/studio/VoiceFirstCreateModal.tsx`](src/components/project/studio/VoiceFirstCreateModal.tsx):

1. **Trust copy up front** — added directly under the subtitle, not
   behind a tooltip: *"Nothing becomes a Project until you confirm the
   draft. Kreto will not invite collaborators, send messages or emails,
   or trigger payments without your approval."*

2. **Expanded "How this works"** — was a permanently-visible 4-card
   strip; now a collapsible (native `<details>`/`<summary>`, closed by
   default) 8-step breakdown, each step tagged **Automatic**,
   **Suggested**, or **You confirm**:

   | # | Step | Tag |
   |---|---|---|
   | 1 | Tell Kreto what you're making | You confirm |
   | 2 | Kreto identifies the type | Suggested |
   | 3 | Kreto drafts the brief & tasks | Automatic |
   | 4 | You review and edit | You confirm |
   | 5 | You confirm the Project | You confirm |
   | 6 | Your room opens | Automatic |
   | 7 | Work becomes Project memory | Automatic |
   | 8 | Credits & invoice at wrap | Suggested |

   Kept collapsed by default so the primary prompt surface isn't
   crowded — matches the "one clear primary action" principle applied
   elsewhere in this pass (Studio Room's phase rail + single next-action
   card).

3. **Guided CTA group — real capabilities, not stickers.** All six named
   actions from the spec are covered, four of them via existing
   affordances (voice button, "Or type it instead", the inspiration
   chips as the template CTA) and two genuinely new:
   - **"Start from a brief or file"** — opens a native file picker,
     converts the file to base64, calls `extract-brief` with
     `source: "doc"`. This backend capability already existed
     (Gemini multimodal PDF/image extraction) — it just wasn't wired
     into this modal before.
   - **"Paste a Google Sheet"** — a small inline URL field, calls
     `extract-brief` with `source: "sheet"`. Also pre-existing backend
     capability, newly wired up. Scoped honestly in its own copy to
     Google Sheets specifically (not "paste any link") because that's
     what the backend actually supports (`fetchPublicSheetAsCsv`).

   Both feed into the same review step as voice/text input — no
   separate code path, no different confirmation semantics.

4. **Canonical CTA reuse** — the text-mode submit button is now
   `<CtaButton>` with copy "Let Kreto draft my Project", matching the
   spec's named primary CTA and reusing the same component
   `StudioCreateHero`/`StudioProjectsDashboard` already use.

## Bug found and fixed during verification

The decorative `<span className="... animate-ping" />` rings behind the
mic button (idle and recording states) had no `pointer-events-none`.
Tailwind's `animate-ping` scales the element via `transform`, and
without `pointer-events-none` its scaled-up hit area was intercepting
clicks meant for the "How this works" toggle sitting just above it —
confirmed via `document.elementFromPoint()` returning the ping span
instead of the summary element at the exact click coordinate. Fixed by
adding `pointer-events-none` to both occurrences (idle + recording).
This was a real, pre-existing-shaped bug (the ping spans existed before
this pass), only surfaces when something interactive sits close enough
above/below the mic button to be in the scaled ring's path — which the
new collapsible "How this works" toggle now does.

## Safety properties preserved

- Drafting (voice, text, file, or sheet) never writes to the database —
  confirmed by reading `processAudio`/`submitText`/`processFile`/
  `submitLink`: all four only ever call `setBrief(...)` +
  `setMode("review")`.
- `createProject()` (the only function that calls
  `.from("projects").insert(...)`) is only reachable from the review
  step's explicit "Create" buttons — unchanged by this pass.
- No collaborator invite, message, or payment call exists anywhere in
  this file.

## Tests

No new automated tests added for this component in this pass (it has
zero prior test coverage — flagged in the Phase 1 audit as a pre-existing
gap, not one this pass closed). Verified instead via direct browser
interaction: typed input enables/disables the CTA correctly, the link
form's Back button returns cleanly to idle state, the file-picker button
triggers the hidden input, "How this works" expands via a real DOM
`.click()` (confirmed the click-target bug above via automation-tool
limitations, not an app bug — see implementation report §5).

## What's not verified

An actual end-to-end file upload or Google Sheet submission — both
would call `extract-brief` for real and consume AI credits/quota this
session had no mandate to spend. Verified the request shape (`source`,
`data_base64`/`mime_type`, or `url`) matches the Edge Function's parsing
exactly by reading both sides of the contract, not by executing it.
