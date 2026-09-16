// Desk Daily Nudge — runs once a day, finds each user's most pressing
// project signal (overdue tasks, unsent draft invoices, deadlines in <=3d),
// and sends ONE consolidated push notification per user.
//
// Triggered by pg_cron — no auth required, but should only be invoked from
// the database scheduler. We accept a shared secret header for safety.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface OverdueTaskRef {
  task_id: string;
  project_id: string;
  project_title: string;
  assignee_id: string;
}
interface DraftInvoiceRef {
  invoice_id: string;
  project_id: string;
  project_title: string;
}
interface PerUserSignal {
  user_id: string;
  overdue: number;
  draft_invoices: number;
  deadlines_soon: Array<{ project_id: string; title: string; deadline: string }>;
  any_project_id: string | null;
  // Agent-mode follow-up targets
  overdue_tasks: OverdueTaskRef[];
  drafts: DraftInvoiceRef[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = new Date();
    const in3Days = new Date(Date.now() + 3 * 86400000);

    // 1. Active projects
    const { data: projects } = await admin
      .from("projects")
      .select("id, title, status, deadline, created_by, client_user_id, creative_user_ids")
      .neq("status", "completed")
      .neq("status", "archived");

    const perUser = new Map<string, PerUserSignal>();
    const ensure = (uid: string): PerUserSignal => {
      if (!perUser.has(uid)) {
        perUser.set(uid, {
          user_id: uid,
          overdue: 0,
          draft_invoices: 0,
          deadlines_soon: [],
          any_project_id: null,
          overdue_tasks: [],
          drafts: [],
        });
      }
      return perUser.get(uid)!;
    };

    // 2. For each project, gather signals & attribute to owners
    for (const p of projects || []) {
      const owners: string[] = [];
      if (p.created_by) owners.push(p.created_by);
      if (Array.isArray(p.creative_user_ids)) owners.push(...p.creative_user_ids);
      const uniqOwners = Array.from(new Set(owners));

      // Deadline soon
      if (p.deadline) {
        const d = new Date(p.deadline);
        if (d > now && d <= in3Days) {
          for (const uid of uniqOwners) {
            const s = ensure(uid);
            s.deadlines_soon.push({ project_id: p.id, title: p.title, deadline: p.deadline });
            s.any_project_id ||= p.id;
          }
        }
      }

      // Overdue tasks per assignee (or owner if unassigned)
      const { data: tasks } = await admin
        .from("project_tasks")
        .select("id, assigned_to, due_date, status")
        .eq("project_id", p.id)
        .neq("status", "done");
      for (const t of tasks || []) {
        if (!t.due_date || new Date(t.due_date) >= now) continue;
        const target = t.assigned_to || p.created_by;
        if (!target) continue;
        const s = ensure(target);
        s.overdue += 1;
        s.any_project_id ||= p.id;
        if (t.assigned_to && t.assigned_to !== target) {
          // owner is being notified about someone else's task — record for nudge
          s.overdue_tasks.push({
            task_id: t.id,
            project_id: p.id,
            project_title: p.title,
            assignee_id: t.assigned_to,
          });
        } else if (t.assigned_to) {
          s.overdue_tasks.push({
            task_id: t.id,
            project_id: p.id,
            project_title: p.title,
            assignee_id: t.assigned_to,
          });
        }
      }

      // Draft invoices per issuer
      const { data: drafts } = await admin
        .from("invoices")
        .select("id, issued_by")
        .eq("project_id", p.id)
        .eq("status", "draft");
      for (const inv of drafts || []) {
        if (!inv.issued_by) continue;
        const s = ensure(inv.issued_by);
        s.draft_invoices += 1;
        s.any_project_id ||= p.id;
        s.drafts.push({ invoice_id: inv.id, project_id: p.id, project_title: p.title });
      }
    }

    // 3. Build & send ONE push per user
    let sent = 0;
    for (const sig of perUser.values()) {
      const lines: string[] = [];
      if (sig.overdue > 0) {
        lines.push(`${sig.overdue} task${sig.overdue > 1 ? "s" : ""} overdue`);
      }
      if (sig.draft_invoices > 0) {
        lines.push(`${sig.draft_invoices} draft invoice${sig.draft_invoices > 1 ? "s" : ""} unsent`);
      }
      if (sig.deadlines_soon.length > 0) {
        lines.push(`${sig.deadlines_soon.length} deadline${sig.deadlines_soon.length > 1 ? "s" : ""} this week`);
      }
      if (lines.length === 0) continue;

      const title = "Your Desk needs a minute";
      const body = lines.slice(0, 3).join(" · ");
      const link = sig.any_project_id ? `/desk/${sig.any_project_id}` : "/desk";

      // In-app notification
      await admin.from("notifications").insert({
        user_id: sig.user_id,
        type: "desk_daily_nudge",
        title,
        message: body,
        action_url: link,
        action_text: "Open Desk",
        category: "desk",
        priority: sig.overdue > 0 ? "high" : "normal",
      });

      // Push (best-effort, don't throw on failures)
      try {
        await admin.functions.invoke("send-push-notification", {
          body: {
            userId: sig.user_id,
            title,
            body,
            tag: "desk_daily_nudge",
            data: { url: link },
          },
        });
      } catch (e) {
        console.warn("push failed for", sig.user_id, e);
      }
      sent += 1;
    }

    // 4. Agent-Mode follow-ups: for users who opted in (orch_settings.agent_mode_projects),
    //    queue Level-2 (requires_approval) actions in orch_actions so they appear in the
    //    Home approvals tray. Cap to keep things calm.
    let proposed = 0;
    const userIds = Array.from(perUser.keys());
    if (userIds.length) {
      const { data: settingsRows } = await admin
        .from("orch_settings")
        .select("user_id, agent_mode_projects, daily_action_limit")
        .in("user_id", userIds);
      const optedIn = new Map<string, { limit: number }>();
      for (const r of settingsRows || []) {
        if ((r as any).agent_mode_projects) {
          optedIn.set((r as any).user_id, { limit: (r as any).daily_action_limit ?? 25 });
        }
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      for (const [uid, cfg] of optedIn) {
        const sig = perUser.get(uid);
        if (!sig) continue;

        const { count: pendingToday } = await admin
          .from("orch_actions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .gte("proposed_at", todayStart.toISOString());
        if ((pendingToday ?? 0) >= cfg.limit) continue;

        const { data: run, error: runErr } = await admin
          .from("orch_runs")
          .insert({
            user_id: uid,
            agent_kind: "client_followup",
            intent: "Daily Desk follow-ups",
            status: "awaiting_approval",
            reasoning: "Auto-proposed from desk-daily-nudge based on overdue tasks and unsent invoices.",
          })
          .select("id")
          .single();
        if (runErr || !run) continue;

        const actions: any[] = [];
        const seenTasks = new Set<string>();
        for (const t of sig.overdue_tasks) {
          if (seenTasks.has(t.task_id)) continue;
          seenTasks.add(t.task_id);
          if (actions.filter((a) => a.tool_name === "send_reminder").length >= 2) break;
          actions.push({
            run_id: run.id,
            user_id: uid,
            tool_name: "send_reminder",
            tool_args: {
              to_user_id: t.assignee_id,
              context: `Friendly nudge about an overdue task on "${t.project_title}".`,
              project_id: t.project_id,
              task_id: t.task_id,
            },
            risk_level: "requires_approval",
            status: "proposed",
            preview_title: `Nudge collaborator on "${t.project_title}"`,
            preview_body: "Send a polite reminder about an overdue task. Tap Approve to send.",
          });
        }

        for (const d of sig.drafts.slice(0, 2)) {
          actions.push({
            run_id: run.id,
            user_id: uid,
            tool_name: "send_payment_link",
            tool_args: { invoice_id: d.invoice_id, project_id: d.project_id },
            risk_level: "requires_approval",
            status: "proposed",
            preview_title: `Send payment link for "${d.project_title}"`,
            preview_body: "You have a draft invoice ready. Tap Approve to send the payment link.",
          });
        }

        if (actions.length === 0) {
          await admin.from("orch_runs").update({ status: "completed" }).eq("id", run.id);
          continue;
        }

        const { error: insErr } = await admin.from("orch_actions").insert(actions);
        if (insErr) {
          console.warn("orch_actions insert failed for", uid, insErr.message);
          continue;
        }
        proposed += actions.length;
      }
    }

    return new Response(
      JSON.stringify({ users_signaled: perUser.size, notified: sent, agent_proposals: proposed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("desk-daily-nudge error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
