// Silent memory extractor. Called fire-and-forget from thrive-ai-chat (and
// optionally other agentic loops) right after a user message lands. Reads the
// latest user turn, asks a small fast model whether the user just stated any
// durable facts (rate, contact, vendor, preference, follow-up, etc.), and
// silently upserts them into thrive_memory. If a project_id is supplied and
// the fact is project-scoped (budget, deadline, brief detail), it also writes
// to studio_facts so it surfaces inside that Studio's brain.
//
// Designed to be cheap: gemini-3-flash-lite, single JSON-object call, hard
// cap of 3 memories per turn, dedupes via upsert on (user_id, kind, mem_key).
// Never throws to the caller; logs failures and exits 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ALLOWED_MEMORY_KINDS = new Set([
  "vendor",
  "sponsor",
  "contact",
  "preference",
  "follow_up",
  "fact",
  "client",
  "rate",
  "note",
]);

const ALLOWED_FACT_KINDS = new Set([
  "budget",
  "deadline",
  "deliverable",
  "rate",
  "contact",
  "constraint",
  "reference",
  "fact",
]);

const SYSTEM = `You are a silent memory extractor for a creative-industry agent named Thrive.
You see ONE recent user message. Decide if the user just stated DURABLE FACTS that Thrive should remember next time.

DURABLE = stable for weeks/months: rates, day-rates, preferred vendors, key contacts, client details, brand preferences, recurring constraints, follow-ups due later, project budgets/deadlines.

NOT durable: greetings, questions, immediate requests ("draft an invoice"), opinions, jokes, single-use commands.

Return a JSON object: { "memories": [ { "scope": "user" | "project", "kind": "<kind>", "mem_key": "<short-stable-slug>", "label": "<5-9 word headline>", "body": "<one sentence detail, optional>", "importance": 1-5 } ] }

Rules:
- 0 to 3 items. Prefer 0 if you're not sure. Quality > quantity.
- "scope": "project" ONLY for project-specific facts (budget, deadline, brief detail, deliverable). Everything else is "user".
- "kind" for scope=user: one of vendor, sponsor, contact, preference, follow_up, fact, client, rate, note.
- "kind" for scope=project: one of budget, deadline, deliverable, rate, contact, constraint, reference, fact.
- "mem_key": short, lowercased, hyphenated, stable across paraphrasing. Example: "day-rate", "client-republic-bank-contact", "preferred-dop-marcus".
- "label": the headline a person would recognize. Example: "Day rate: $1,500 USD".
- "body": optional context. Empty if the label already says it.
- "importance": 5 = critical recurring fact (rates, key clients), 3 = useful, 1 = trivia.
- NEVER extract from questions, requests, or hypotheticals. The user must be STATING a fact about themselves or their work.
- If nothing qualifies, return { "memories": [] }.`;

interface Memory {
  scope: "user" | "project";
  kind: string;
  mem_key: string;
  label: string;
  body?: string;
  importance?: number;
}

async function extract(message: string): Promise<Memory[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    console.warn("memory-extract gateway", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return [];
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const list = Array.isArray(parsed?.memories) ? parsed.memories : [];
    return list.slice(0, 3).filter((m: any): m is Memory =>
      m && typeof m.kind === "string" && typeof m.mem_key === "string" && typeof m.label === "string"
    );
  } catch (e) {
    console.warn("memory-extract parse failed", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role only — called from other edge functions.
  const auth = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${SERVICE_ROLE}`;
  if (auth !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { user_id?: string; message?: string; project_id?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { user_id, message, project_id } = body;
  if (!user_id || !message || message.trim().length < 12) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cheap gate: only run on messages that smell like statements, not commands.
  const lc = message.toLowerCase().trim();
  const isQuestion = lc.endsWith("?") || /^(what|how|when|where|why|who|can you|could you|would you|do you|did you|will you|should i|am i)\b/.test(lc);
  const isCommand = /^(draft|create|make|send|post|find|search|add|remove|delete|invite|book|schedule|generate|build|open|show|tell me|list|update|move|archive|run|kick off|set up)\b/.test(lc);
  if (isQuestion || isCommand) {
    return new Response(JSON.stringify({ ok: true, skipped: "command-or-question" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let extracted: Memory[] = [];
  try {
    extracted = await extract(message);
  } catch (e) {
    console.warn("memory-extract failed", e);
  }

  let inserted = 0;
  for (const mem of extracted) {
    const importance = Math.max(1, Math.min(5, Math.round(mem.importance ?? 3)));
    if (mem.scope === "project" && project_id) {
      if (!ALLOWED_FACT_KINDS.has(mem.kind)) continue;
      const { error } = await admin.from("studio_facts").insert({
        project_id,
        kind: mem.kind,
        label: mem.label,
        value: mem.body ?? null,
        importance,
        source_kind: "thrive_chat",
        source_excerpt: message.slice(0, 280),
        created_by: user_id,
        confidence: 0.7,
      });
      if (error) {
        console.warn("studio_facts insert failed", error.message);
      } else {
        inserted++;
      }
    } else {
      const kind = ALLOWED_MEMORY_KINDS.has(mem.kind) ? mem.kind : "fact";
      const { error } = await admin.from("thrive_memory").upsert(
        {
          user_id,
          kind,
          mem_key: mem.mem_key.toLowerCase().slice(0, 80),
          label: mem.label.slice(0, 160),
          body: mem.body ?? null,
          importance,
          context: { source: "auto_extract", project_id: project_id ?? null },
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,kind,mem_key" },
      );
      if (error) {
        console.warn("thrive_memory upsert failed", error.message);
      } else {
        inserted++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, extracted: extracted.length, inserted }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
