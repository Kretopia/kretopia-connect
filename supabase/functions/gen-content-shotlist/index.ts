// Generates a shot list from a brief using Lovable AI Gateway (Gemini).
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { z } from 'npm:zod@4';
import { corsFor, readJson, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from '../_shared/promptIsolation.ts';
const BodySchema = z.object({ brief: z.string().min(1).max(24000), project_title: z.string().max(1000).nullish(), format: z.string().max(1000).nullish() });

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAiCaller(req, 'gen-content-shotlist');
    const { brief, project_title, format } = await readJson(req, BodySchema);
    if (!brief || typeof brief !== "string") {
      return new Response(JSON.stringify({ error: "brief required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are a creative producer. Convert briefs into concrete shot lists for ${wrapUntrustedContent("content format", format || "short-form video / photo content")}.
Return ONLY JSON: { "shots": [{ "scene_no": 1, "shot_no": 1, "description": "...", "shot_type": "wide|medium|close-up|over-shoulder|insert|establishing", "location": "...", "talent": ["..."], "props": ["..."], "duration_seconds": 5 }, ...] }
Aim for 6-12 shots. Be specific and shootable. No extra prose.${PROMPT_INJECTION_DEFENSE_CLAUSE}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: wrapUntrustedContent("shot list input", `Project: ${project_title || "Untitled"}\n\nBrief:\n${brief}`) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Shot list provider failed", res.status, txt);
      return safeError(new Error("Shot list provider failed"), req);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { shots: [] }; }
    const shots = Array.isArray(parsed.shots) ? parsed.shots : [];

    return new Response(JSON.stringify({ shots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return safeError(e, req);
  }
});
