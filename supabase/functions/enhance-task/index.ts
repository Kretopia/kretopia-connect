// enhance-task: takes a single rough task title (and optional project context),
// returns enriched fields: refined title, description, due_date, priority, assignee.
// Mirrors the elevate-brief / voice-to-task pattern but for a single manually-typed task.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { z } from "npm:zod@4";
import { corsFor, readJson, safeError } from "../_shared/guard.ts";
import { requireAiCaller } from "../_shared/aiPerimeter.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const BodySchema = z.object({
  raw_title: z.string().trim().min(1).max(4000),
  existing_description: z.string().max(16000).nullish(),
  project_title: z.string().max(1000).nullish(),
  project_description: z.string().max(16000).nullish(),
  collaborators: z.array(z.object({ id: z.string().uuid(), full_name: z.string().max(255), role: z.string().max(255).nullish() })).max(100).default([]),
  today_iso: z.iso.date().optional(),
});

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAiCaller(req, "enhance-task");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const {
      raw_title,
      existing_description,
      project_title,
      project_description,
      collaborators = [],
      today_iso,
    } = await readJson(req, BodySchema);

    if (!raw_title || !raw_title.trim()) {
      return new Response(JSON.stringify({ error: "raw_title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = today_iso || new Date().toISOString().slice(0, 10);
    const collabList = collaborators.length
      ? collaborators.map((c) => `- ${c.full_name} (id: ${c.id}${c.role ? `, role: ${c.role}` : ""})`).join("\n")
      : "(no collaborators — assignee_user_id must be null)";

    const systemPrompt = `You are a senior creative producer. A creative founder just typed a quick, rough task. Your job is to enhance it into a clear, actionable task without changing its meaning.

Today is ${today}.
${project_title ? wrapUntrustedContent("project title", project_title) : ""}
${project_description ? wrapUntrustedContent("project context", project_description) : ""}

Available collaborators (only use these exact ids for assignee_user_id):
${wrapUntrustedContent("collaborator records", collabList)}

Rules:
- title: concise, imperative, max 80 chars (e.g. "Send shot list to Maya"). Keep the user's intent. Don't include the assignee name in the title.
- description: 1-3 short sentences of helpful context, sub-steps, or acceptance criteria. Pull from the project context if relevant. Null only if the title is fully self-explanatory.
- due_date: ISO YYYY-MM-DD. Resolve relative phrases ("tomorrow", "next Friday", "EOW", "in 2 days") against today. Null if no time signal.
- priority: "low" | "normal" | "high" | "urgent". Infer from words like "urgent/asap/blocking" → urgent; "important/priority" → high; otherwise "normal". Default "normal".
- assignee_user_id: match spoken names against the collaborator list (fuzzy, first-name OK). Null if no name said or no match.

Always call the enhance_task tool. Never reply in plain text.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const userMsg = wrapUntrustedContent("task input", `Raw task: "${raw_title.trim()}"${existing_description ? `\nExisting description: ${existing_description}` : ""}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "enhance_task",
              description: "Return the enhanced task fields.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Enhanced concise title, max 80 chars." },
                  description: { type: ["string", "null"] },
                  due_date: { type: ["string", "null"], description: "ISO YYYY-MM-DD or null." },
                  priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                  assignee_user_id: { type: ["string", "null"] },
                },
                required: ["title", "description", "due_date", "priority", "assignee_user_id"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "enhance_task" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Workspace AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return safeError(new Error("AI gateway request failed"), req);
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No enhancement returned" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return safeError(e, req);
  }
});
