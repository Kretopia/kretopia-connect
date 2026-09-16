import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    // Accept `action` from direct calls OR `_tool` from the agent orchestrator.
    // Also accept snake_case `project_id` / `target_project_id` aliases.
    const action = body.action ?? body._tool;
    const projectId = body.projectId ?? body.project_id ?? body.target_project_id;
    const brief = body.brief ?? body.project_brief ?? body.description ?? "";
    const message = body.message;
    const milestones = body.milestones;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Fetch project context if projectId provided
    let projectContext = "";
    if (projectId) {
      // IDOR fix (STUDIO_CURRENT_STATE_AUDIT.md finding 3): this function
      // used to fetch and embed the project's title/description/status
      // and every milestone's amount into the AI prompt for ANY
      // authenticated caller who supplied a projectId, with no check that
      // they had any relationship to it. The AI's response (returned
      // directly to the caller) is built from that context, so an
      // attacker who knew or guessed another user's project UUID could
      // reliably exfiltrate that project's brief and milestone amounts
      // through the analyze_brief/generate_milestones/check_scope_drift
      // responses. Same user_has_project_access RPC used by every other
      // project-scoped Edge Function in this codebase (create-video-room,
      // mint-video-token, studio-ingest, desk-agent) -- reject before
      // touching any project data, not after.
      const { data: hasAccess } = await supabase.rpc('user_has_project_access', {
        project_id_param: projectId,
        user_id_param: user.id,
      });
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: 'You do not have access to this project' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: project } = await supabase
        .from('projects')
        .select('title, description, status')
        .eq('id', projectId)
        .single();
      
      if (project) {
        projectContext = `Project: "${project.title}"\nDescription: ${project.description || 'None provided'}\nStatus: ${project.status}`;
      }

      // Get existing milestones for context
      const { data: existingMilestones } = await supabase
        .from('milestones')
        .select('title, description, amount, status')
        .eq('project_id', projectId);

      if (existingMilestones?.length) {
        projectContext += `\n\nExisting Milestones:\n${existingMilestones.map(m => 
          `- ${m.title} ($${m.amount}) [${m.status}]: ${m.description || ''}`
        ).join('\n')}`;
      }
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "analyze_brief": {
        systemPrompt = `You are a Scope Guardian AI for creative professionals. You analyze project briefs and descriptions to identify vague language, missing details, and potential scope creep risks BEFORE work begins.

Your job is to PROTECT both the creative and the client by flagging ambiguity.

Respond ONLY with valid JSON:
{
  "risk_score": <number 0-100, higher = more risky>,
  "risk_level": "low" | "medium" | "high" | "critical",
  "flags": [
    {
      "text": "The exact vague phrase from the brief",
      "issue": "Why this is problematic",
      "suggestion": "How to make it specific and measurable",
      "severity": "low" | "medium" | "high"
    }
  ],
  "missing_elements": [
    "List of important elements not mentioned (e.g., revision limits, file formats, deadlines)"
  ],
  "recommended_additions": [
    "Specific clauses or details to add to protect both parties"
  ],
  "summary": "1-2 sentence overall assessment"
}`;
        userPrompt = `Analyze this project brief for scope creep risks and vague language:\n\n${brief}\n\n${projectContext}`;
        break;
      }

      case "generate_milestones": {
        systemPrompt = `You are a Scope Guardian AI that creates fair, protective milestone payment schedules for creative projects. 

Your milestones should:
- Protect the creative (they get paid as they deliver)
- Protect the client (they only pay for completed work)
- Be specific and measurable (no vague "completion" milestones)
- Include clear deliverables for each payment trigger
- Follow industry-standard creative project phases

Respond ONLY with valid JSON:
{
  "milestones": [
    {
      "title": "Clear milestone name",
      "description": "Specific deliverables that trigger this payment",
      "percentage": <number, percentage of total budget>,
      "phase": "discovery" | "production" | "review" | "delivery",
      "deliverables": ["Specific output 1", "Specific output 2"]
    }
  ],
  "total_phases": <number>,
  "revision_policy": "Recommended revision limits and policy",
  "payment_schedule_notes": "Important notes about the payment schedule"
}`;
        userPrompt = `Generate a protective milestone payment schedule for this project:\n\n${brief}\n\n${projectContext}`;
        break;
      }

      case "check_scope_drift": {
        const milestonesContext = milestones?.length
          ? `\nAgreed Milestones:\n${milestones.map((m: any) => `- ${m.title}: ${m.description || ''}`).join('\n')}`
          : '';

        systemPrompt = `You are a Scope Guardian AI that detects scope creep in client messages. You analyze messages against the original project brief and agreed milestones to determine if a request is IN SCOPE or OUT OF SCOPE.

You protect creatives from unpaid work while being fair to clients.

Respond ONLY with valid JSON:
{
  "verdict": "in_scope" | "out_of_scope" | "borderline",
  "confidence": <number 0-100>,
  "explanation": "Why this is or isn't within the original scope",
  "original_scope_reference": "Which part of the brief/milestones this relates to, or 'not found' if it's new work",
  "recommended_action": "What the creative should do",
  "change_order": {
    "needed": true | false,
    "suggested_title": "Change order title if needed",
    "estimated_impact": "Time/cost impact description",
    "professional_response": "A professional message the creative can send to the client acknowledging the request and explaining it's outside the agreed scope"
  }
}`;
        userPrompt = `Project Brief: ${brief}\n${milestonesContext}\n\nClient message to analyze:\n"${message}"\n\n${projectContext}`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action. Use: analyze_brief, generate_milestones, check_scope_drift' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Parse JSON from response
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis");
    }

    return new Response(JSON.stringify({ result: parsed, action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Scope guardian error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
