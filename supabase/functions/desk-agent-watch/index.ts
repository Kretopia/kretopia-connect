// desk-agent-watch
// Reads recent project chat + state and proposes 0–2 next moves
// (draft invoice, schedule follow-up, next milestone, wrap project).
// Writes results to public.agent_proposals; client renders them as
// ProactiveCards. Throttled to 1 run / project / 30 min.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ALLOWED_KINDS = [
  "draft_invoice",
  "schedule_followup",
  "next_milestone",
  "wrap_project",
  "collab_nudge",
] as const;

type Kind = typeof ALLOWED_KINDS[number];

interface Proposal {
  kind: Kind;
  title: string;
  body: string;
  action_intent: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const { project_id } = await req.json().catch(() => ({}));
    if (!project_id || typeof project_id !== "string") {
      return json({ error: "project_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Owner check + project context
    const { data: project, error: pErr } = await admin
      .from("projects")
      .select(
        "id, user_id, title, description, client_user_id, client_name, status, created_at, workspace_type",
      )
      .eq("id", project_id)
      .maybeSingle();
    if (pErr || !project) return json({ error: "project not found" }, 404);
    if (project.user_id !== user.id) {
      return json({ error: "not project owner" }, 403);
    }

    // Tier gate: Autonomous Agent (background proposals) is Creator+ / Founder / Brand Enterprise only.
    // Lower tiers can still trigger proposals on-tap via the orchestrator; this background
    // watcher is the privileged "runs in the background" surface from the pricing page.
    const { data: prof } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle();
    const tier = (prof?.subscription_tier ?? "free") as string;
    const ALLOWED = new Set(["creator_pro", "founder", "brand_enterprise"]);
    if (!ALLOWED.has(tier)) {
      return json({ ok: true, gated: true, tier, proposals: [] });
    }

    // Throttle: 1 run / project / 30 min
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentRuns } = await admin
      .from("agent_proposals")
      .select("id, created_at")
      .eq("project_id", project_id)
      .gte("created_at", since)
      .limit(1);
    if (recentRuns && recentRuns.length > 0) {
      return json({ ok: true, throttled: true, proposals: [] });
    }

    // Gather recent context
    const [msgsRes, tasksRes, invRes, pendingRes] = await Promise.all([
      admin
        .from("project_messages")
        .select("id, user_id, message, created_at, voice_transcript")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false })
        .limit(25),
      admin
        .from("tasks")
        .select("id, title, status, due_date, assignee_id")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("invoices")
        .select("id, status, total, currency, created_at, document_type")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("agent_proposals")
        .select("kind, created_at")
        .eq("project_id", project_id)
        .eq("status", "pending"),
    ]);

    const messages = (msgsRes.data ?? []).reverse();
    const tasks = tasksRes.data ?? [];
    const invoices = invRes.data ?? [];
    const pendingKinds = new Set((pendingRes.data ?? []).map((p) => p.kind));

    if (messages.length < 2) {
      return json({ ok: true, proposals: [], reason: "not enough chat" });
    }

    const openTasks = tasks.filter((t) => t.status !== "done");
    const doneTasks = tasks.filter((t) => t.status === "done");
    const overdue = openTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date(),
    );

    // Resolve display names for chat snippet
    const userIds = Array.from(new Set(messages.map((m) => m.user_id)));
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const nameMap = new Map(
      (profs ?? []).map((p) => [p.user_id, p.full_name ?? "User"]),
    );

    const chatLines = messages
      .map((m) => {
        const who = m.user_id === project.user_id
          ? "OWNER"
          : nameMap.get(m.user_id) ?? "Collab";
        const txt = (m.message || m.voice_transcript || "").slice(0, 240);
        return `${who}: ${txt}`;
      })
      .join("\n");

    const stateSummary = [
      `Project: ${project.title}`,
      `Workspace: ${project.workspace_type ?? "general"}`,
      `Status: ${project.status ?? "active"}`,
      `Client: ${project.client_name ?? (project.client_user_id ? "linked" : "none")}`,
      `Tasks: ${openTasks.length} open, ${doneTasks.length} done, ${overdue.length} overdue`,
      `Invoices: ${invoices.length} total (${invoices.filter((i) => i.status === "draft").length} draft, ${invoices.filter((i) => i.status === "paid").length} paid)`,
      `Pending proposals already shown: ${[...pendingKinds].join(", ") || "none"}`,
    ].join("\n");

    const sys = `You are Kreto, a proactive operator inside a creative project workspace.
Read the recent collaborator chat and project state. Decide if there are 0, 1, or at most 2 high-leverage next moves the OWNER should take RIGHT NOW.

ONLY propose something if the chat or state STRONGLY suggests it. If unsure, propose NOTHING.
NEVER repeat a kind that is already pending (see "Pending proposals already shown").
NEVER hallucinate amounts, dates, names, or facts. Quote evidence from the chat in the body.

Allowed kinds:
- draft_invoice: chat shows work delivered/agreed scope/client asking for an invoice and no recent draft exists.
- schedule_followup: a collaborator promised to do X "by Y", or a question is unanswered for 24h+, or chat fizzled out mid-decision.
- next_milestone: phase clearly wrapped (e.g. "approved", "love it") and no next task queued.
- wrap_project: ≥80% tasks done AND chat reads like sign-off ("we're done", "thanks for everything").
- collab_nudge: an unblocking question is sitting unanswered to a specific collaborator.

For each proposal include action_intent with concrete, parameterized fields (e.g. {"target_user_id": "...", "amount_hint": 500, "currency": "USD", "due_in_days": 7, "task_title": "..."}).
Keep title ≤ 60 chars. Body ≤ 200 chars, conversational, quote 1 short chat snippet as evidence.
Return JSON only: {"proposals":[...]} or {"proposals":[]}.`;

    const userPrompt = `STATE\n-----\n${stateSummary}\n\nRECENT CHAT (oldest → newest, last 25)\n--------------------------------------\n${chatLines}\n\nReturn JSON only.`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "ai_failed", detail: t.slice(0, 500) }, 502);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { proposals?: Proposal[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { proposals: [] };
    }

    const clean: Proposal[] = (parsed.proposals ?? [])
      .filter((p): p is Proposal =>
        !!p &&
        ALLOWED_KINDS.includes(p.kind as Kind) &&
        typeof p.title === "string" &&
        typeof p.body === "string" &&
        !pendingKinds.has(p.kind),
      )
      .slice(0, 2)
      .map((p) => ({
        kind: p.kind,
        title: p.title.slice(0, 80),
        body: p.body.slice(0, 240),
        action_intent: typeof p.action_intent === "object" && p.action_intent
          ? p.action_intent
          : {},
      }));

    if (clean.length === 0) {
      return json({ ok: true, proposals: [] });
    }

    const rows = clean.map((p) => ({
      project_id,
      owner_user_id: project.user_id,
      kind: p.kind,
      title: p.title,
      body: p.body,
      action_intent: p.action_intent,
      source_signal: { last_msg_at: messages[messages.length - 1]?.created_at },
    }));
    const { data: inserted, error: insErr } = await admin
      .from("agent_proposals")
      .insert(rows)
      .select("id, kind, title, body, action_intent, status, created_at");
    if (insErr) {
      console.error("insert error", insErr);
      return json({ error: "insert_failed", detail: insErr.message }, 500);
    }
    return json({ ok: true, proposals: inserted });
  } catch (e) {
    console.error("watch error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
