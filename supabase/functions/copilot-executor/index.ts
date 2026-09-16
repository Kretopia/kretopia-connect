// Thrive Copilot — Executor
// Runs an approved multi-step plan, one step at a time, halting on failure.
// Substitutes {{step_N.field}} placeholders from prior step outputs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Step {
  index: number;
  tool_name: string;
  label: string;
  rationale: string;
  args: Record<string, unknown>;
  agent_kind: string;
  handler: string | null;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  result: unknown;
}

async function createProjectForPlan(
  args: Record<string, unknown>,
  userId: string,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const title = String(args.title ?? args.project_title ?? "").trim().slice(0, 120);
  const description = args.description ? String(args.description).slice(0, 4000) : null;

  if (!userId) return { ok: false, error: "Missing authenticated user for project creation" };
  if (!title) return { ok: false, error: "Project title is required" };

  const { data: project, error } = await admin
    .from("projects")
    .insert({
      title,
      description,
      created_by: userId,
      status: "active",
      deal_type: "solo",
      workspace_type: String(args.workspace_type ?? "general"),
      setup_completed: true,
    })
    .select("id, title")
    .single();

  if (error || !project) return { ok: false, error: error?.message ?? "Project create failed" };

  const { data: existingOwner } = await admin
    .from("project_collaborators")
    .select("id")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existingOwner) {
    await admin.from("project_collaborators").insert({
      project_id: project.id,
      user_id: userId,
      role: "owner",
      status: "accepted",
      invited_by: userId,
      accepted_at: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    result: {
      project_id: project.id,
      id: project.id,
      title: project.title,
      action_url: `/desk/${project.id}`,
      card: {
        icon: "project",
        title: `Studio ready: ${project.title}`,
        subtitle: "Open the Studio Room to keep going.",
        href: `/desk/${project.id}`,
      },
    },
  };
}

// Walk a value tree and replace {{step_N.field}} or {{step_N.candidates.0.user_id}} tokens
function resolvePlaceholders(value: unknown, completed: Step[]): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{step_(\d+)\.([\w.]+)\}\}/g, (_m, n, path) => {
      const idx = parseInt(n, 10) - 1;
      const step = completed[idx];
      if (!step || step.status !== "succeeded") return "";
      // Drill into result object using dot-path; tolerates result.X and X
      const r: any = step.result;
      const keys = String(path).split(".");
      let cur: any = r;
      for (const k of keys) {
        if (cur == null) return "";
        cur = cur[k];
      }
      // Fallback: if first key missing, try inside r.result, r.candidates[0], r.matches[0], r.projects[0]
      if (cur === undefined) {
        const fallback =
          r?.result ??
          (Array.isArray(r?.candidates) ? r.candidates[0] : null) ??
          (Array.isArray(r?.matches) ? r.matches[0] : null) ??
          (Array.isArray(r?.projects) ? r.projects[0] : null);
        if (fallback) {
          let c: any = fallback;
          for (const k of keys) {
            if (c == null) break;
            c = c[k];
          }
          if (c !== undefined) return String(c);
        }
        return "";
      }
      return cur === null ? "" : String(cur);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, completed));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolvePlaceholders(v, completed);
    }
    return out;
  }
  return value;
}

function firstPresent<T = unknown>(...values: T[]): T | undefined {
  return values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
}

function normalizeStepArgs(step: Step, rawArgs: Record<string, unknown>, projectId: string | null): Record<string, unknown> {
  const args: Record<string, unknown> = { ...rawArgs };

  if (projectId && (step.handler === "desk-agent" || step.handler === "copilot-collaborator-tools")) {
    args.project_id = firstPresent(args.project_id, args.target_project_id, projectId);
    args.target_project_id = firstPresent(args.target_project_id, args.project_id);
  }

  if (step.handler === "desk-agent" && !args.message) {
    if (step.tool_name === "draft_invoice") {
      const amount = firstPresent(args.amount, args.total_amount, args.price, args.value);
      const currency = firstPresent(args.currency, "USD");
      const notes = firstPresent(args.notes, args.description, args.line_item, step.label);
      args.amount = Number(amount ?? 0);
      args.currency = String(currency).toUpperCase();
      args.notes = notes;
      args.message = `Draft a ${args.currency} ${args.amount} invoice for ${notes}`;
    } else {
      args.message = String(firstPresent(args.message, args.title, args.what, args.notes, args.description, step.label));
    }
  }

  if (step.tool_name === "create_task" && !args.title) args.title = String(args.message ?? step.label);
  if (step.tool_name === "schedule_reminder" && !args.what) args.what = String(args.title ?? args.message ?? step.label);
  if (step.tool_name === "add_credit" && !args.role) args.role = String(args.title ?? args.description ?? "Contributor");

  if (step.handler === "copilot-collaborator-tools") {
    if (step.tool_name === "add_collaborator") args.user_id_to_add = firstPresent(args.user_id_to_add, args.user_id);
    if (step.tool_name === "remove_collaborator") args.user_id_to_remove = firstPresent(args.user_id_to_remove, args.user_id);
  }

  return args;
}

async function dispatchStep(
  step: Step,
  completed: Step[],
  authHeader: string,
  projectId: string | null,
  userId: string,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const args = normalizeStepArgs(step, resolvePlaceholders(step.args, completed) as Record<string, unknown>, projectId);

  if (step.tool_name === "create_project") {
    return await createProjectForPlan(args, userId);
  }

  // Inline tools handled here (no edge fn)
  if (step.handler === "inline" || step.tool_name === "ask_clarification") {
    return { ok: true, result: { question: (args as any).question ?? step.label } };
  }

  // For collaborator tools, default project_id to the plan's project
  if (
    (step.tool_name === "add_collaborator" || step.tool_name === "remove_collaborator") &&
    !args.target_project_id &&
    projectId
  ) {
    args.target_project_id = projectId;
  }

  // Pass tool name marker so multi-tool handlers route internally
  (args as any)._tool = step.tool_name;
  if (step.handler === "scope-guardian" && !(args as any).action) {
    (args as any).action = step.tool_name;
  }

  if (!step.handler) {
    return { ok: false, error: `No handler registered for ${step.tool_name}` };
  }

  try {
    const url = `${SUPABASE_URL}/functions/v1/${step.handler}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(args),
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    if (!resp.ok) {
      return {
        ok: false,
        error: typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300),
      };
    }
    if (parsed && typeof parsed === "object") {
      const payload = parsed as any;
      const failedAction = Array.isArray(payload.actions) ? payload.actions.find((a: any) => a?.ok === false) : null;
      if (payload.ok === false || failedAction) {
        const nestedError = failedAction?.result?.error ?? payload.error ?? payload.reply ?? "Tool action failed";
        return { ok: false, error: String(nestedError).slice(0, 300) };
      }
    }
    return { ok: true, result: parsed };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimErr } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimErr || !userId) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const planId: string = body.plan_id;
    const decision: "approved" | "rejected" = body.decision ?? "approved";
    const skipIndices: number[] = Array.isArray(body.skip_indices) ? body.skip_indices.map((n: any) => Number(n)) : [];
    if (!planId) return json({ error: "plan_id required" }, 400);

    const { data: plan, error: planErr } = await admin
      .from("copilot_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();
    if (planErr || !plan) return json({ error: "Plan not found" }, 404);
    if (!["proposed", "approved"].includes(plan.status)) {
      return json({ error: `Plan already ${plan.status}` }, 400);
    }

    if (decision === "rejected") {
      await admin
        .from("copilot_plans")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", planId);
      return json({ ok: true, status: "cancelled" });
    }

    // Mark running
    await admin.from("copilot_plans").update({ status: "running", current_step: 0 }).eq("id", planId);

    const steps: Step[] = (plan.steps as Step[]) ?? [];
    const completed: Step[] = [];
    let currentProjectId: string | null = plan.project_id ?? null;
    let failed = false;
    let failureReason: string | null = null;

    for (let i = 0; i < steps.length; i++) {
      // User opted out of this step — mark skipped and continue
      if (skipIndices.includes(steps[i].index)) {
        completed.push({ ...steps[i], status: "skipped", result: { skipped_by_user: true } });
        await admin
          .from("copilot_plans")
          .update({ current_step: i + 1, steps: completed.concat(steps.slice(i + 1)) })
          .eq("id", planId);
        continue;
      }

      const step = { ...steps[i], status: "running" as const };
      completed.push(step);
      await admin
        .from("copilot_plans")
        .update({ current_step: i + 1, steps: completed.concat(steps.slice(i + 1)) })
        .eq("id", planId);

      const res = await dispatchStep(step, completed.slice(0, i), authHeader, currentProjectId, userId);
      step.status = res.ok ? "succeeded" : "failed";
      step.result = res.ok ? res.result : { error: res.error };
      completed[i] = step;
      const nextProjectId = (res.result as any)?.project_id ?? (res.result as any)?.result?.project_id;
      if (res.ok && typeof nextProjectId === "string" && nextProjectId) {
        currentProjectId = nextProjectId;
      }

      // Persist progress so the UI can poll/stream
      await admin
        .from("copilot_plans")
        .update({ steps: completed.concat(steps.slice(i + 1)) })
        .eq("id", planId);

      if (!res.ok) {
        failed = true;
        failureReason = `Step ${i + 1} (${step.tool_name}) failed: ${res.error}`;
        // Mark remaining as skipped
        for (let j = i + 1; j < steps.length; j++) {
          completed.push({ ...steps[j], status: "skipped", result: null });
        }
        break;
      }
    }

    const finalStatus = failed ? "failed" : "completed";
    const summary = failed
      ? failureReason
      : `Completed ${completed.filter((s) => s.status === "succeeded").length}/${steps.length} steps.`;

    await admin
      .from("copilot_plans")
      .update({
        status: finalStatus,
        steps: completed,
        project_id: currentProjectId,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", planId);

    return json({
      ok: !failed,
      status: finalStatus,
      summary,
      steps: completed,
    });
  } catch (e) {
    console.error("copilot-executor error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
