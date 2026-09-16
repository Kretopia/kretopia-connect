// ep-daily-briefing
// Executive Producer's daily briefing. Scans the user's projects, tasks,
// invoices, contracts, opportunities, and recent chat activity and writes
// (or refreshes) one ep_daily_briefings row per user per day. The frontend
// renders sections as action chips.
//
// Auth: end-user JWT. Idempotent per (user_id, today). Server-side throttle
// of 30 min via row created_at.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Item = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  due?: string | null;
};

type Section = {
  key: "today" | "risks" | "followups" | "wins" | "opportunities";
  title: string;
  items: Item[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const today = todayUTC();

    // Idempotent: serve existing if generated within last 30min
    const { data: existing } = await admin
      .from("ep_daily_briefings")
      .select("*")
      .eq("user_id", user.id)
      .eq("brief_date", today)
      .maybeSingle();
    if (
      existing &&
      Date.now() - new Date(existing.created_at).getTime() < 30 * 60 * 1000
    ) {
      return json({ ok: true, briefing: existing, cached: true });
    }

    // ===== Scan signals =====
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86400000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();

    // Owned projects
    const { data: projects } = await admin
      .from("projects")
      .select("id, title, status, workspace_type")
      .eq("owner_id", user.id)
      .neq("status", "archived")
      .limit(50);
    const projectIds = (projects ?? []).map((p) => p.id);

    // Today's / overdue tasks
    const { data: tasks } = projectIds.length
      ? await admin
          .from("project_tasks")
          .select("id, title, due_date, status, project_id")
          .in("project_id", projectIds)
          .neq("status", "done")
          .lte("due_date", sevenDays)
          .order("due_date", { ascending: true })
          .limit(20)
      : { data: [] as any[] };

    // Overdue deliverables
    const { data: deliverables } = projectIds.length
      ? await admin
          .from("project_deliverables")
          .select("id, title, due_date, status, project_id")
          .in("project_id", projectIds)
          .lt("due_date", now.toISOString())
          .neq("status", "approved")
          .neq("status", "delivered")
          .limit(20)
      : { data: [] as any[] };

    // Unsigned contracts
    const { data: contracts } = projectIds.length
      ? await admin
          .from("project_contracts")
          .select("id, title, status, project_id, created_at")
          .in("project_id", projectIds)
          .in("status", ["draft", "sent"])
          .limit(10)
      : { data: [] as any[] };

    // Unpaid invoices
    const { data: invoices } = await admin
      .from("invoices")
      .select("id, invoice_number, status, total, due_date")
      .eq("user_id", user.id)
      .in("status", ["sent", "overdue", "pending"])
      .limit(10);

    // Stalled outreach / scouted gigs drafted but not applied
    const { data: scouted } = await admin
      .from("scouted_gigs")
      .select("id, title, source")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    // ===== Build sections =====
    const todaySection: Section = { key: "today", title: "Today", items: [] };
    const risksSection: Section = { key: "risks", title: "Risks", items: [] };
    const followupsSection: Section = {
      key: "followups",
      title: "Follow-ups",
      items: [],
    };
    const oppsSection: Section = {
      key: "opportunities",
      title: "Opportunities",
      items: [],
    };

    (tasks ?? []).forEach((t: any) => {
      const overdue = t.due_date && new Date(t.due_date) < now;
      (overdue ? risksSection : todaySection).items.push({
        id: t.id,
        label: t.title,
        detail: overdue ? "Overdue" : t.due_date ? "Due " + t.due_date : "Today",
        href: "/desk/" + t.project_id,
        due: t.due_date,
      });
    });

    (deliverables ?? []).forEach((d: any) => {
      risksSection.items.push({
        id: d.id,
        label: d.title,
        detail: "Deliverable overdue",
        href: "/desk/" + d.project_id,
        due: d.due_date,
      });
    });

    (contracts ?? []).forEach((c: any) => {
      const ageDays =
        (Date.now() - new Date(c.created_at).getTime()) / 86400000;
      if (ageDays > 3) {
        followupsSection.items.push({
          id: c.id,
          label: c.title ?? "Contract",
          detail: c.status === "draft" ? "Unsigned draft" : "Awaiting signature",
          href: "/desk/" + c.project_id,
        });
      }
    });

    (invoices ?? []).forEach((i: any) => {
      const overdue = i.due_date && new Date(i.due_date) < now;
      (overdue ? risksSection : followupsSection).items.push({
        id: i.id,
        label: "Invoice " + (i.invoice_number ?? i.id.slice(0, 8)),
        detail: overdue ? "Overdue" : "Awaiting payment",
        href: "/thrivepay",
      });
    });

    (scouted ?? []).forEach((g: any) => {
      oppsSection.items.push({
        id: g.id,
        label: g.title,
        detail: g.source ? "via " + g.source : "Scouted",
        href: "/scout",
      });
    });

    const sections = [todaySection, risksSection, followupsSection, oppsSection]
      .filter((s) => s.items.length > 0);

    // Optional LLM summary
    let summary: string | null = null;
    if (LOVABLE_API_KEY && sections.length > 0) {
      try {
        const compact = sections
          .map(
            (s) =>
              s.title +
              ": " +
              s.items
                .slice(0, 4)
                .map((i) => i.label + (i.detail ? " (" + i.detail + ")" : ""))
                .join("; "),
          )
          .join(" • ");
        const resp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": LOVABLE_API_KEY,
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You are an Executive Producer. Write ONE crisp morning brief, 1-2 sentences, present-tense, no emojis, no greetings, no 'good morning'. Mention the most urgent item by name. Under 220 chars.",
                },
                { role: "user", content: compact },
              ],
            }),
          },
        );
        if (resp.ok) {
          const j = await resp.json();
          summary = j?.choices?.[0]?.message?.content?.trim() ?? null;
        }
      } catch (_e) {
        // best-effort
      }
    }

    const payload = {
      user_id: user.id,
      brief_date: today,
      sections,
      summary,
      task_count: todaySection.items.length,
      risk_count: risksSection.items.length,
      followup_count: followupsSection.items.length,
      generated_by: summary ? "ai" : "rule",
    };

    const { data: saved, error: saveErr } = await admin
      .from("ep_daily_briefings")
      .upsert(payload, { onConflict: "user_id,brief_date" })
      .select("*")
      .maybeSingle();
    if (saveErr) {
      return json({ error: saveErr.message }, 500);
    }

    return json({ ok: true, briefing: saved });
  } catch (e) {
    console.error("ep-daily-briefing error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
