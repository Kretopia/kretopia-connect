import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadCopilotContext, renderContextPreamble } from "../_shared/copilotContext.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { guardProjectAccess } from "../_shared/projectAccess.ts";
import { ABUSE_CEILING_DAILY_MESSAGES, dailyCapFor } from "../_shared/premiumSwitch.ts";

// Bounds time-to-first-byte on the gateway call, not total response
// duration -- see _shared/fetchWithTimeout.ts.
const GATEWAY_CONNECT_TIMEOUT_MS = 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_DAILY_LIMIT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, message, mode = "chat" } = body || {};
    if (!project_id || (!message && mode === "chat")) {
      return new Response(JSON.stringify({ error: "project_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify project access: owner or ACCEPTED collaborator only. The old
    // user_has_project_access RPC also admits 'pending' invitees, and this
    // function reads with the service role below.
    const guard = await guardProjectAccess(admin, project_id, user.id, corsHeaders);
    if (!guard.ok) return guard.response;
    const access = guard.access;

    // Daily limit check (free tier) -- tier is looked up server-side from
    // profiles.subscription_tier, never trusted from the client. Previously
    // this read a client-supplied `is_pro` body field directly with no
    // server-side check at all, so any authenticated caller could send
    // {"is_pro": true} and get unlimited free DeskAI usage. The
    // check-and-increment is also now atomic via the same
    // consume_copilot_message RPC thrive-ai-chat already uses on this same
    // desk_ai_usage table (the prior select-then-upsert-at-the-end was a
    // separate non-atomic race under concurrent requests).
    const { data: profile } = await admin.from("profiles")
      .select("subscription_tier").eq("user_id", user.id).maybeSingle();
    const isPro = ((profile?.subscription_tier as string) || "free") !== "free";
    // Premium is not enforced yet: a free account is held only by the safety ceiling.
    const dailyCap = dailyCapFor(isPro ? -1 : FREE_DAILY_LIMIT, ABUSE_CEILING_DAILY_MESSAGES);

    const { data: capCheck, error: capErr } = await admin.rpc("consume_copilot_message", {
      _user_id: user.id, _daily_cap: dailyCap,
    }).single();
    if (capErr) {
      console.error("consume_copilot_message failed", capErr);
      return new Response(JSON.stringify({ error: "Could not verify usage limit. Try again shortly." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!capCheck?.allowed) {
      return new Response(JSON.stringify({
        error: "daily_limit",
        message: `You've used ${dailyCap} DeskAI messages today. Come back tomorrow.`,
        used: capCheck?.used ?? 0, limit: dailyCap,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gather project context AND unified user identity (parallel)
    const [projectRes, tasksRes, milestonesRes, filesRes, messagesRes, notesRes, copilotCtx] = await Promise.all([
      // Money columns only for roles that may see money (owner / creative /
      // collaborator) -- the service role would otherwise hand client and
      // guest members budget and milestone amounts through the prompt.
      admin.from("projects").select(access.canSeeMoney ? "id, title, description, status, deadline, budget, currency, created_by" : "id, title, description, status, deadline, currency, created_by").eq("id", project_id).single(),
      admin.from("project_tasks").select("title, status, due_date, assigned_to, priority").eq("project_id", project_id).order("created_at", { ascending: false }).limit(50),
      admin.from("milestones").select(access.canSeeMoney ? "title, status, due_date, amount" : "title, status, due_date").eq("project_id", project_id).order("created_at").limit(20),
      admin.from("project_files").select("file_name, file_type, created_at").eq("project_id", project_id).order("created_at", { ascending: false }).limit(20),
      admin.from("project_messages").select("user_id, message, created_at").eq("project_id", project_id).order("created_at", { ascending: false }).limit(30),
      admin.from("project_notes").select("title, content").eq("project_id", project_id).limit(10),
      loadCopilotContext(admin, user.id).catch(() => null),
    ]);

    const project = projectRes.data;
    const isOwner = project?.created_by === user.id;
    const role = isOwner ? "client" : "creator";

    // Conversation history (last 20 messages this user)
    const { data: history } = await admin.from("desk_ai_messages")
      .select("role, content").eq("project_id", project_id).eq("user_id", user.id)
      .order("created_at", { ascending: true }).limit(20);

    // Build context summary
    const today2 = new Date();
    const overdue = (tasksRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < today2 && t.status !== "done");
    const openTasks = (tasksRes.data || []).filter((t: any) => t.status !== "done");
    const upcomingMs = (milestonesRes.data || []).filter((m: any) => m.status !== "completed");

    const contextBlock = `
PROJECT: ${project?.title}
Status: ${project?.status} | Deadline: ${project?.deadline || "n/a"} | Budget: ${project?.budget ? `${project.currency || ""} ${project.budget}` : "n/a"}
Description: ${project?.description?.slice(0, 500) || "none"}

OPEN TASKS (${openTasks.length}, ${overdue.length} overdue):
${openTasks.slice(0, 15).map((t: any) => `- [${t.status}${t.priority ? `/${t.priority}` : ""}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n") || "(none)"}

MILESTONES (${upcomingMs.length} active):
${upcomingMs.slice(0, 8).map((m: any) => `- [${m.status}] ${m.title}${m.due_date ? ` due ${m.due_date}` : ""}${m.amount ? ` — ${m.amount}` : ""}`).join("\n") || "(none)"}

RECENT FILES:
${(filesRes.data || []).slice(0, 8).map((f: any) => `- ${f.file_name}`).join("\n") || "(none)"}

RECENT CHAT (newest first):
${(messagesRes.data || []).slice(0, 10).map((m: any) => `- ${m.message?.slice(0, 200)}`).join("\n") || "(none)"}

NOTES:
${(notesRes.data || []).slice(0, 5).map((n: any) => `- ${n.title}: ${(n.content || "").slice(0, 200)}`).join("\n") || "(none)"}
`.trim();

    const roleGuidance = role === "creator"
      ? "You are speaking with the CREATOR (the freelancer/agency delivering the work). Focus on: production timeline, scope protection, getting client approvals, payment milestones, deliverables, and avoiding scope creep. Be a protective producer for them."
      : "You are speaking with the CLIENT (the project owner/brand). Focus on: tracking deliverables, what needs your approval, timeline visibility, budget status, and clear next steps for you. Be their accountable producer.";

    const userPreamble = copilotCtx
      ? renderContextPreamble(copilotCtx, "desk", { project_id })
      : "";

    const systemPrompt = `You are DeskAI, the in-project assistant for Studio — a creative project workspace. You are part of the same Kreto family the user already knows. The USER FACTS block below is ALREADY loaded — never claim "I don't have your context".
${roleGuidance}

${userPreamble || "(no profile loaded — proceed without a name)"}

MANDATORY: If USER FACTS lists a first name, use it in your FIRST sentence. NEVER use bracketed placeholders like "[Name]" or "[Project]". NEVER claim you don't know the user when USER FACTS shows a name. If a fact isn't in USER FACTS, omit it — don't invent it.

Be concise, specific, and actionable. Use short paragraphs and bullet lists. Reference the actual tasks/milestones/files by name when relevant. If asked to draft something (reply, brief, invoice, status update), produce it ready-to-send. If you spot risks (overdue tasks, missing approvals, scope drift, payment delays), call them out.

CURRENT PROJECT CONTEXT:
${contextBlock}

Today's date: ${new Date().toISOString().slice(0, 10)}. Keep replies under 250 words unless drafting a document.`;

    // Mode: "suggest" returns proactive suggestions; "chat" is conversational
    let userMessages: any[] = [];
    if (mode === "suggest") {
      userMessages = [{ role: "user", content: "Based on the project context above, give me 3 short, actionable suggestions for what I should focus on right now. Format as a numbered list. Each item: one bold action + one short reason. No preamble." }];
    } else {
      userMessages = [
        ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ];
    }

    let aiResp: Response;
    try {
      aiResp = await fetchWithTimeout(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: GEMINI_3_FLASH,
            messages: [{ role: "system", content: systemPrompt }, ...userMessages],
          }),
        },
        GATEWAY_CONNECT_TIMEOUT_MS,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "AI response timed out. Please try again." }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw e;
    }

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const reply = aiJson.choices?.[0]?.message?.content || "(no reply)";

    // Persist (only chat mode) + bump usage
    if (mode === "chat") {
      await admin.from("desk_ai_messages").insert([
        { project_id, user_id: user.id, role: "user", content: message },
        { project_id, user_id: user.id, role: "assistant", content: reply },
      ]);
    }

    // Usage was already atomically incremented by consume_copilot_message above.

    return new Response(JSON.stringify({
      reply, role, used: capCheck.used, limit: dailyCap === -1 ? null : dailyCap,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("desk-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
