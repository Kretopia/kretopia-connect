// Thrive Copilot — Executor
// Runs an approved multi-step plan, one step at a time, halting on failure.
// Substitutes {{step_N.field}} placeholders from prior step outputs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { corsFor } from '../_shared/guard.ts';
import { checkPlanStep, HANDLER_PATTERN, internalToolBody, stripReservedKeys, type RegistryTool } from '../_shared/approvalHardening.ts';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
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

  // The creator is the owner through projects.created_by: 'owner' is not a role project_collaborators stores
  // (project_collaborators_role_check allows member, client, creative, guest), so a row for it was always rejected.

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
  // Arguments come from a stored plan (model output). Fields that carry authority (_tool, _source, _agent_action_id) are set
  // below by this function and nowhere else.
  const args = normalizeStepArgs(step, stripReservedKeys(resolvePlaceholders(step.args, completed)), projectId);

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

  if (step.handler === "scope-guardian" && !(args as any).action) {
    (args as any).action = step.tool_name;
  }

  if (!step.handler) {
    return { ok: false, error: `No handler registered for ${step.tool_name}` };
  }
  // The handler is one path segment of our own functions (the run already checked it against the registry).
  if (!HANDLER_PATTERN.test(step.handler)) {
    return { ok: false, error: `Handler for ${step.tool_name} is not a valid function name` };
  }

  try {
    const url = `${SUPABASE_URL}/functions/v1/${step.handler}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      // The tool name marker routes multi-tool handlers; the caller kind is the plan executor, written here and last.
      body: JSON.stringify(internalToolBody({ tool: step.tool_name, args, source: "agent_orchestrator" })),
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
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(corsHeaders, { error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimErr } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimErr || !userId) return json(corsHeaders, { error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const planId: string = body.plan_id;
    // A decision is a person's act: a request that does not state one runs nothing (it used to default to "approved").
    const decision = body.decision;
    const skipIndices: number[] = Array.isArray(body.skip_indices) ? body.skip_indices.map((n: any) => Number(n)) : [];
    if (!planId) return json(corsHeaders, { error: "plan_id required" }, 400);
    if (decision !== "approved" && decision !== "rejected") {
      return json(corsHeaders, { error: "decision must be 'approved' or 'rejected'" }, 400);
    }

    const { data: plan, error: planErr } = await admin
      .from("copilot_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();
    if (planErr || !plan) return json(corsHeaders, { error: "Plan not found" }, 404);
    if (!["proposed", "approved"].includes(plan.status)) {
      return json(corsHeaders, { error: `Plan already ${plan.status}` }, 400);
    }

    if (decision === "rejected") {
      // Conditional, like the claim below: a plan another request already started is not cancelled underneath it.
      const { data: cancelled, error: cancelErr } = await admin
        .from("copilot_plans")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", planId)
        .eq("user_id", userId)
        .in("status", ["proposed", "approved"])
        .select("id");
      if (cancelErr) return json(corsHeaders, { error: "Could not update the plan" }, 503);
      if (!cancelled || cancelled.length === 0) return json(corsHeaders, { error: "Plan already decided or running" }, 409);
      return json(corsHeaders, { ok: true, status: "cancelled" });
    }

    const steps: Step[] = (plan.steps as Step[]) ?? [];

    // The plan row is data its owner can write; what each step may run is decided by the registry, not by the row.
    // Checked before anything is claimed or run, so a refused plan changes nothing.
    const toRun = steps.filter((s) => !skipIndices.includes(s.index));
    const toolNames = [...new Set(toRun.map((s) => (typeof s.tool_name === "string" ? s.tool_name : "")))].filter(Boolean);
    const { data: registryRows, error: registryErr } = toolNames.length
      ? await admin.from("orch_tool_registry").select("tool_name, handler, risk_level, enabled").in("tool_name", toolNames)
      : { data: [] as RegistryTool[], error: null };
    // A failed lookup must not read as "nothing is locked": no execution.
    if (registryErr) return json(corsHeaders, { error: "Could not verify the plan's tools" }, 503);
    const registry = new Map<string, RegistryTool>((registryRows ?? []).map((r: RegistryTool) => [String(r.tool_name), r]));
    for (const step of toRun) {
      const verdict = checkPlanStep(step, registry);
      if (!verdict.ok) {
        return json(corsHeaders, { error: `Step ${Number(step.index) + 1} cannot run: ${verdict.reason}`, reason: verdict.reason }, 403);
      }
    }

    // One plan, one run: claim it by compare-and-set before the first step. Two requests for the same plan (a double tap, a
    // retry, a replay) used to both read "proposed" and both run every step; only the request whose UPDATE matches a row proceeds.
    const { data: claimed, error: startErr } = await admin
      .from("copilot_plans")
      .update({ status: "running", current_step: 0 })
      .eq("id", planId)
      .eq("user_id", userId)
      .in("status", ["proposed", "approved"])
      .select("id");
    if (startErr) return json(corsHeaders, { error: "Could not start the plan" }, 503);
    if (!claimed || claimed.length === 0) return json(corsHeaders, { error: "Plan already decided or running" }, 409);
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

    return json(corsHeaders, {
      ok: !failed,
      status: finalStatus,
      summary,
      steps: completed,
    });
  } catch (e) {
    console.error("copilot-executor error", e);
    return json(corsHeaders, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
