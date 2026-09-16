// Elevate-brief: takes a rough brief (text or voice) + project context + collaborator list,
// returns: { elevated_brief, deliverables[], tasks[] } where each task has a suggested assignee.
//
// This is the "Smart Brief" flow — the user types/dictates a rough intent, AI researches,
// elevates it into a polished brief, breaks it into deliverables + actionable tasks,
// and intelligently routes each task to the best collaborator based on their role.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Collaborator {
  user_id: string;
  display_name?: string | null;
  role?: string | null; // e.g. "designer", "videographer"
  agent_role?: string | null;
}

interface SuggestedTask {
  title: string;
  description?: string;
  due_offset_days?: number | null; // days from today
  suggested_assignee_id?: string | null;
  priority?: "low" | "normal" | "high";
}

interface SuggestedDeliverable {
  title: string;
  description?: string;
  kind?: string;
  due_offset_days?: number | null;
  suggested_assignee_id?: string | null;
}

interface RunOfShowItem {
  time?: string | null;
  duration_min?: number | null;
  segment_title: string;
  notes?: string | null;
}
interface SupplierItem {
  category: string;
  name: string;
  notes?: string | null;
}
interface TalentItem {
  role: string;
  name: string;
  notes?: string | null;
}

interface ElevateOut {
  elevated_brief: {
    title: string;
    summary: string;
    objectives: string[];
    audience: string;
    tone: string;
    success_criteria: string[];
    research_notes: string[];
  };
  deliverables: SuggestedDeliverable[];
  tasks: SuggestedTask[];
  run_of_show?: RunOfShowItem[];
  suppliers?: SupplierItem[];
  talent?: TalentItem[];
}

const buildSystemPrompt = (collaborators: Collaborator[]) => {
  const roster = collaborators.length
    ? collaborators
        .map(
          (c) =>
            `- id="${c.user_id}" name="${c.display_name ?? "Unknown"}" role="${c.role ?? c.agent_role ?? "collaborator"}"`,
        )
        .join("\n")
    : "(no collaborators yet — leave suggested_assignee_id null)";

  return `You are a senior creative producer + project copilot.

You are given a ROUGH brief from a busy creative founder. Your job:
1. RESEARCH & ELEVATE it into a polished, professional brief that any collaborator can pick up and execute.
2. Break it into clear DELIVERABLES (the artifacts to produce).
3. Break it into actionable TASKS (the steps to get there).
4. Intelligently SUGGEST AN ASSIGNEE for each task and deliverable from the roster below, based on each person's role.

Available collaborators:
${roster}

Output STRICT JSON matching this TypeScript type:
{
  "elevated_brief": {
    "title": string,                    // refined project title
    "summary": string,                  // 1-2 sentence executive summary
    "objectives": string[],             // 2-4 clear objectives
    "audience": string,                 // who this is for
    "tone": string,                     // creative direction / mood
    "success_criteria": string[],       // 2-4 measurable wins
    "research_notes": string[]          // 2-5 insights, references, or context AI adds (industry best practice, similar campaigns, technical considerations)
  },
  "deliverables": Array<{
    "title": string,
    "description": string,
    "kind": "image"|"video"|"audio"|"voiceover"|"music"|"writing"|"design"|"social_post"|"document"|"other",
    "due_offset_days": number | null,   // days from today, or null
    "suggested_assignee_id": string | null  // MUST be a user_id from the roster, or null
  }>,
  "tasks": Array<{
    "title": string,
    "description": string,
    "due_offset_days": number | null,
    "suggested_assignee_id": string | null,
    "priority": "low" | "normal" | "high"
  }>,
  "run_of_show": Array<{
    "time": string | null,
    "duration_min": number | null,
    "segment_title": string,
    "notes": string | null
  }>,
  "suppliers": Array<{
    "category": "venue"|"catering"|"av"|"decor"|"transport"|"security"|"production"|"other",
    "name": string,
    "notes": string | null
  }>,
  "talent": Array<{
    "role": "performer"|"host"|"dj"|"speaker"|"musician"|"other",
    "name": string,
    "notes": string | null
  }>
}

Rules:
- Be concrete and creative. Add VALUE — don't just rephrase the rough input.
- Use research_notes to surface industry insights the founder might not have thought of.
- Match each task/deliverable to the best collaborator's role.
- ALWAYS produce 2+ deliverables and 4-10 tasks. NEVER return a single task.
- If the brief has a schedule / run-of-show / itinerary, extract it into run_of_show in chronological order (use 24h "HH:MM").
- If the brief lists vendors, suppliers, bands, performers, or DJs by name, extract them into suppliers / talent.
- If the brief has a "decisions needed" or open-questions section, turn EACH into a HIGH-priority task.
- Omit run_of_show / suppliers / talent (return []) when the brief isn't an event/production.
- Return ONLY the JSON object, no prose, no markdown fences.`;
};

async function callGemini(parts: unknown[], systemPrompt: string, apiKey: string): Promise<ElevateOut> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-pro-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parts },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  let parsed: ElevateOut;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (!parsed?.elevated_brief || !Array.isArray(parsed.tasks)) {
    throw new Error("AI response missing elevated_brief or tasks");
  }
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth fix (STUDIO_OVERHAUL_V2_AUDIT.md security risk #1): see the
    // matching comment in extract-brief/index.ts -- same gap, same fix.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const projectTitle: string = body.project_title ?? "Untitled project";
    const collaborators: Collaborator[] = Array.isArray(body.collaborators) ? body.collaborators : [];
    const source: "text" | "audio" = body.source ?? "text";

    let parts: unknown[] = [];
    const ctx = `Project: "${projectTitle}".\n\n`;

    if (source === "text") {
      const text: string = body.text ?? "";
      if (!text.trim()) throw new Error("text is required for source=text");
      parts = [{ type: "text", text: `${ctx}Rough brief from the founder:\n\n${text}` }];
    } else if (source === "audio") {
      const dataBase64: string = body.data_base64 ?? "";
      const mimeType: string = body.mime_type ?? "audio/webm";
      if (!dataBase64) throw new Error("data_base64 is required for source=audio");
      const format = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "webm";
      parts = [
        {
          type: "text",
          text: `${ctx}Rough brief delivered as a voice memo. FIRST transcribe everything the founder said in full. THEN elevate it into a polished brief, deliverables, and 4-10 actionable tasks. Do NOT collapse it into a single task — break the work down into the concrete steps a collaborator would need to execute it.`,
        },
        { type: "input_audio", input_audio: { data: dataBase64, format } },
      ];
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

    const result = await callGemini(parts, buildSystemPrompt(collaborators), LOVABLE_API_KEY);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("elevate-brief error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
