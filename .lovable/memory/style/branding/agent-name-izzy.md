---
name: Agent is Izzy
description: The Executive Producer agent is named Izzy. Thrive/Kretopia remain the platform.
type: design
---

**Izzy** = the agent. **Thrive / Kretopia** = the platform.

User-facing copy ALWAYS says Izzy when referring to the assistant:
- "Meet Izzy. Your Creative Executive Producer."
- "Izzy noticed something." / "Izzy drafted…" / "Izzy scouted…" / "Izzy remembers…"
- aria-labels: "Open Izzy", "Talk to Izzy", "Ask Izzy…"

Source of truth: `src/lib/brandLexicon.ts` → `BRAND.agentName = "Izzy"`, `BRAND.agentTagline = "Meet Izzy. Your Creative Executive Producer."`

Edge function system prompts now say `You are Izzy…` (thrive-ai-chat, thrive-document-engine, thrive-creative-tools, desk-agent, desk-agent-watch, draft-lead-reply, inbox-triage-agent, route-thrive-intent, route-studio-outcome, transcribe-call, telegram-webhook).

Code-side names kept (NOT user-facing): file/route names like `ThriveAgentFab`, `thrive-ai-chat`, `/thrive/generate`, table names, `BRAND` object key — they're internal.

Never reintroduce "Thrive noticed/drafted/scouted/remembers" or "Meet Thrive" — those name the agent. "Made with Kretopia" on share pages is fine (platform attribution).
