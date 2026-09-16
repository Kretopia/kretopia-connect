// Shared Copilot Context loader.
// One canonical snapshot used by every AI surface (Thrive Copilot chat,
// Desk agent, ThrivePay nudges, etc.) so the assistant always speaks to
// the user with the same identity + live state — no matter where they
// invoke it from.
//
// Design rules:
//  - One round-trip-ish: parallel queries with a hard timeout.
//  - Read-only. Never mutates.
//  - Always returns a usable shape; missing data degrades gracefully.
//  - Output is BOTH a structured object (for tools/JSON) and a
//    natural-language preamble (drop straight into a system prompt).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface CopilotProject {
  id: string;
  title: string;
  status: string | null;
  pinned_stage: string | null;
  my_role?: string | null;
}

export interface CopilotEvent {
  id: string;
  title: string;
  start_time: string | null;
  venue_name: string | null;
}

export interface CopilotContext {
  user_id: string;
  // Identity
  full_name: string | null;
  first_name: string;
  username: string | null;
  role: string | null;
  sub_roles: string[] | null;
  location: string | null;
  account_type: string | null;
  bio: string | null;
  // Live state
  active_projects: CopilotProject[];
  unpaid_invoices_count: number; // sent/viewed/overdue — money owed TO user
  unpaid_invoices_total: number;
  invoice_currency: string | null;
  draft_invoices_count: number; // unsent drafts — not owed yet, but pending action
  draft_invoices_total: number;
  draft_invoices_currency: string | null;
  upcoming_events: CopilotEvent[];
  recent_credits_count: number;
  // Recent activity (last 7 days) — what the user has actually been doing
  recent_activity: {
    tasks_completed: Array<{ title: string; project_id: string | null; updated_at: string }>;
    tasks_due_soon: Array<{ title: string; due_date: string; project_id: string | null }>;
    credits_added: Array<{ project_name: string; role: string; created_at: string }>;
    new_connections: number;
    invoices_paid: Array<{ invoice_number: string; total_amount: number; currency: string; paid_at: string }>;
    invoices_sent: Array<{ invoice_number: string; total_amount: number; currency: string; created_at: string; recipient: string | null }>;
    unread_notifications: number;
    last_notification_titles: string[];
  };
}

/** Race a promise against a timeout; returns null on timeout or error. */
async function withTimeout<T>(p: Promise<T>, ms = 4000): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  } catch (_) {
    return null;
  }
}

/**
 * Load the unified Copilot context for a user.
 * Uses a service-role client (bypasses RLS) — safe because we only read
 * data we already know the user owns or is a participant of.
 */
export async function loadCopilotContext(
  admin: SupabaseClient,
  userId: string,
): Promise<CopilotContext> {
  const empty: CopilotContext = {
    user_id: userId,
    full_name: null,
    first_name: "there",
    username: null,
    role: null,
    sub_roles: null,
    location: null,
    account_type: null,
    bio: null,
    active_projects: [],
    unpaid_invoices_count: 0,
    unpaid_invoices_total: 0,
    invoice_currency: null,
    draft_invoices_count: 0,
    draft_invoices_total: 0,
    draft_invoices_currency: null,
    upcoming_events: [],
    recent_credits_count: 0,
    recent_activity: {
      tasks_completed: [],
      tasks_due_soon: [],
      credits_added: [],
      new_connections: 0,
      invoices_paid: [],
      invoices_sent: [],
      unread_notifications: 0,
      last_notification_titles: [],
    },
  };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // Parallel fan-out, each capped at ~1.5s. Total worst-case stays under 2s.
  const [
    profileRes,
    projectsRes,
    projectCollabsRes,
    invoicesRes,
    eventsRes,
    creditsRes,
    // --- recent activity (last 7 days) ---
    tasksDoneRes,
    tasksDueRes,
    creditsRecentRes,
    connectionsRes,
    invoicesPaidRes,
    invoicesSentRes,
    notifUnreadRes,
    notifRecentRes,
  ] = await Promise.all([
    withTimeout(
      admin
        .from("profiles")
        .select("full_name, username, role, sub_roles, location, account_type, bio")
        .eq("user_id", userId)
        .maybeSingle(),
    ),
    withTimeout(
      admin
        .from("projects")
        .select("id, title, status, pinned_stage, updated_at")
        .eq("status", "active")
        .or(
          `created_by.eq.${userId},client_user_id.eq.${userId},agent_user_id.eq.${userId}`,
        )
        .order("updated_at", { ascending: false })
        .limit(20),
    ),
    withTimeout(
      admin
        .from("project_collaborators")
        .select("project_id, role, status")
        .eq("user_id", userId)
        .eq("status", "accepted")
        .limit(50),
    ),
    withTimeout(
      admin
        .from("invoices")
        .select("total_amount, currency, status")
        .eq("issued_by", userId)
        .in("status", ["sent", "overdue", "viewed", "draft"]),
    ),
    withTimeout(
      admin
        .from("creative_jams")
        .select("id, title, start_time, venue_name")
        .eq("created_by", userId)
        .gte("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(3),
    ),
    withTimeout(
      admin
        .from("credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ),
    // tasks completed in last 7 days (assigned to or created by user)
    withTimeout(
      admin
        .from("project_tasks")
        .select("title, project_id, updated_at, status, assigned_to, created_by")
        .eq("status", "done")
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .gte("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: false })
        .limit(5),
    ),
    // tasks due in next 7 days, not done, assigned to user
    withTimeout(
      admin
        .from("project_tasks")
        .select("title, due_date, project_id, status")
        .neq("status", "done")
        .eq("assigned_to", userId)
        .not("due_date", "is", null)
        .gte("due_date", nowIso)
        .lte("due_date", sevenDaysAhead)
        .order("due_date", { ascending: true })
        .limit(5),
    ),
    // credits added in last 7 days
    withTimeout(
      admin
        .from("credits")
        .select("project_name, role, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),
    ),
    // new accepted connections in last 7 days (where user is recipient)
    withTimeout(
      admin
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("connected_user_id", userId)
        .eq("status", "accepted")
        .gte("created_at", sevenDaysAgo),
    ),
    // invoices paid in last 7 days
    withTimeout(
      admin
        .from("invoices")
        .select("invoice_number, total_amount, currency, paid_at")
        .eq("issued_by", userId)
        .eq("status", "paid")
        .gte("paid_at", sevenDaysAgo)
        .order("paid_at", { ascending: false })
        .limit(5),
    ),
    // invoices sent in last 7 days
    withTimeout(
      admin
        .from("invoices")
        .select("invoice_number, total_amount, currency, created_at, recipient_name, status")
        .eq("issued_by", userId)
        .in("status", ["sent", "viewed", "overdue"])
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),
    ),
    // unread notifications count
    withTimeout(
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false),
    ),
    // last 5 notification titles (for "what's new" summary)
    withTimeout(
      admin
        .from("notifications")
        .select("title, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),
    ),
  ]);

  const profile = (profileRes as any)?.data ?? null;
  const directProjects = ((projectsRes as any)?.data as Array<CopilotProject & { updated_at?: string }> | null) ?? [];
  const collabRows = ((projectCollabsRes as any)?.data as Array<{ project_id: string; role: string | null }> | null) ?? [];
  let projects: CopilotProject[] = directProjects.map((p) => ({ ...p, my_role: "owner" }));
  const directProjectIds = new Set(projects.map((p) => p.id));
  const collabProjectIds = collabRows.map((r) => r.project_id).filter((id) => !directProjectIds.has(id));
  if (collabProjectIds.length) {
    const collabProjectsRes = await withTimeout(
      admin
        .from("projects")
        .select("id, title, status, pinned_stage, updated_at")
        .in("id", collabProjectIds)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(20),
    );
    const collabProjects = ((collabProjectsRes as any)?.data ?? []) as Array<CopilotProject & { updated_at?: string }>;
    projects = [
      ...projects,
      ...collabProjects.map((p) => ({
        ...p,
        my_role: collabRows.find((r) => r.project_id === p.id)?.role ?? "member",
      })),
    ];
  }
  projects = projects.slice(0, 20);
  const invoiceRows = ((invoicesRes as any)?.data as Array<{ total_amount: number | null; currency: string | null; status: string }> | null) ?? [];
  const events = ((eventsRes as any)?.data as CopilotEvent[] | null) ?? [];
  const creditsCount = (creditsRes as any)?.count ?? 0;

  const fullName = profile?.full_name ?? null;
  const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "there";

  // Split into "owed to user" (sent/viewed/overdue) vs "drafts" (not sent yet)
  const owedRows = invoiceRows.filter((r) => r.status !== "draft");
  const draftRows = invoiceRows.filter((r) => r.status === "draft");

  function dominantCurrencyAndTotal(rows: typeof invoiceRows) {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const c = r.currency ?? "USD";
      counts[c] = (counts[c] ?? 0) + 1;
    }
    const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const total = rows
      .filter((r) => (r.currency ?? "USD") === dom)
      .reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);
    return { dom, total };
  }

  const owed = dominantCurrencyAndTotal(owedRows);
  const drafts = dominantCurrencyAndTotal(draftRows);

  const tasksDone = ((tasksDoneRes as any)?.data ?? []) as Array<{ title: string; project_id: string | null; updated_at: string }>;
  const tasksDue = ((tasksDueRes as any)?.data ?? []) as Array<{ title: string; due_date: string; project_id: string | null }>;
  const creditsRecent = ((creditsRecentRes as any)?.data ?? []) as Array<{ project_name: string; role: string; created_at: string }>;
  const newConnections = ((connectionsRes as any)?.count ?? 0) as number;
  const invoicesPaid = ((invoicesPaidRes as any)?.data ?? []) as Array<{ invoice_number: string; total_amount: number; currency: string; paid_at: string }>;
  const invoicesSent = (((invoicesSentRes as any)?.data ?? []) as Array<{ invoice_number: string; total_amount: number; currency: string; created_at: string; recipient_name: string | null }>).map((r) => ({
    invoice_number: r.invoice_number,
    total_amount: Number(r.total_amount),
    currency: r.currency,
    created_at: r.created_at,
    recipient: r.recipient_name,
  }));
  const unreadNotifs = ((notifUnreadRes as any)?.count ?? 0) as number;
  const notifTitles = (((notifRecentRes as any)?.data ?? []) as Array<{ title: string }>).map((r) => r.title);

  return {
    ...empty,
    full_name: fullName,
    first_name: firstName,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    sub_roles: (profile?.sub_roles as string[] | null) ?? null,
    location: profile?.location ?? null,
    account_type: profile?.account_type ?? null,
    bio: profile?.bio ?? null,
    active_projects: projects,
    unpaid_invoices_count: owedRows.length,
    unpaid_invoices_total: owed.total,
    invoice_currency: owed.dom,
    draft_invoices_count: draftRows.length,
    draft_invoices_total: drafts.total,
    draft_invoices_currency: drafts.dom,
    upcoming_events: events,
    recent_credits_count: creditsCount,
    recent_activity: {
      tasks_completed: tasksDone.map((t) => ({ title: t.title, project_id: t.project_id, updated_at: t.updated_at })),
      tasks_due_soon: tasksDue.map((t) => ({ title: t.title, due_date: t.due_date, project_id: t.project_id })),
      credits_added: creditsRecent,
      new_connections: newConnections,
      invoices_paid: invoicesPaid.map((i) => ({ ...i, total_amount: Number(i.total_amount) })),
      invoices_sent: invoicesSent,
      unread_notifications: unreadNotifs,
      last_notification_titles: notifTitles,
    },
  };
}

/**
 * Render the context as a natural-language preamble suitable for a
 * system prompt. Surface-aware: omits sections that are empty so we
 * don't waste tokens.
 */
export function renderContextPreamble(
  ctx: CopilotContext,
  surface?: string,
  surfaceContext?: Record<string, unknown>,
): string {
  const parts: string[] = [];

  // ---- Identity (always present) ----
  const displayName = ctx.full_name?.trim() || ctx.username || "this creator";
  const firstName = ctx.first_name && ctx.first_name !== "there" ? ctx.first_name : null;

  parts.push(`=== USER FACTS (verified, from database) ===`);
  parts.push(`Full name: ${ctx.full_name ?? "(not set)"}`);
  if (firstName) {
    parts.push(`First name to use when addressing them: ${firstName}`);
  } else {
    parts.push(`First name: NOT SET — do NOT use a placeholder. Greet warmly without a name (e.g. "Hey —").`);
  }
  if (ctx.username) parts.push(`Username: @${ctx.username}`);
  if (ctx.role) parts.push(`Role: ${ctx.role}`);
  if (ctx.sub_roles?.length) parts.push(`Also: ${ctx.sub_roles.slice(0, 4).join(", ")}`);
  if (ctx.location) parts.push(`Location: ${ctx.location}`);
  if (ctx.account_type === "company") parts.push(`Account type: Company / brand account`);

  // ---- Live state (only include sections that have data) ----
  if (ctx.active_projects.length) {
    const list = ctx.active_projects
      .map((p) => `- "${p.title}"${p.my_role ? ` (${p.my_role})` : ""}${p.pinned_stage ? ` (stage: ${p.pinned_stage})` : ""} [id: ${p.id}]`)
      .join("\n");
    parts.push(`Active projects (${ctx.active_projects.length}):\n${list}`);
  } else {
    parts.push(`Active projects: NONE`);
  }

  if (ctx.unpaid_invoices_count > 0) {
    parts.push(
      `Invoices SENT and awaiting payment (money owed TO user): ${ctx.unpaid_invoices_count} totalling ${ctx.invoice_currency ?? "USD"} ${ctx.unpaid_invoices_total.toFixed(2)}`,
    );
  } else {
    parts.push(`Invoices SENT and awaiting payment: NONE`);
  }

  if (ctx.draft_invoices_count > 0) {
    parts.push(
      `DRAFT invoices (created but NOT sent yet — user still needs to send or mark as paid): ${ctx.draft_invoices_count} totalling ${ctx.draft_invoices_currency ?? "USD"} ${ctx.draft_invoices_total.toFixed(2)}. ` +
      `IMPORTANT: When the user asks about "outstanding payments", "unpaid invoices", or "what am I owed", mention these drafts too — they may have forgotten to mark one as paid or send it.`,
    );
  } else {
    parts.push(`Draft (unsent) invoices: NONE`);
  }

  if (ctx.upcoming_events.length) {
    const evs = ctx.upcoming_events
      .map((e) => `- "${e.title}"${e.start_time ? ` on ${new Date(e.start_time).toLocaleDateString()}` : ""}`)
      .join("\n");
    parts.push(`Upcoming events they're hosting:\n${evs}`);
  } else {
    parts.push(`Upcoming events they're hosting: NONE`);
  }

  parts.push(`Credits added in last 30 days: ${ctx.recent_credits_count}`);

  // ---- Recent activity (last 7 days) — for "catch me up" / "what's new" ----
  const ra = ctx.recent_activity;
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffH = Math.round((now.getTime() - d.getTime()) / 3_600_000);
      if (diffH < 1) return "just now";
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.round(diffH / 24);
      return diffD === 1 ? "yesterday" : `${diffD}d ago`;
    } catch { return iso; }
  };

  parts.push(`\n=== RECENT ACTIVITY (last 7 days) ===`);
  const activityLines: string[] = [];

  if (ra.tasks_completed.length) {
    activityLines.push(
      `Tasks completed (${ra.tasks_completed.length}):\n` +
      ra.tasks_completed.map((t) => `  - "${t.title}" (${fmtDate(t.updated_at)})`).join("\n"),
    );
  }
  if (ra.tasks_due_soon.length) {
    activityLines.push(
      `Tasks due in next 7 days (${ra.tasks_due_soon.length}):\n` +
      ra.tasks_due_soon.map((t) => `  - "${t.title}" due ${new Date(t.due_date).toLocaleDateString()}`).join("\n"),
    );
  }
  if (ra.credits_added.length) {
    activityLines.push(
      `New credits added (${ra.credits_added.length}):\n` +
      ra.credits_added.map((c) => `  - ${c.role} on "${c.project_name}" (${fmtDate(c.created_at)})`).join("\n"),
    );
  }
  if (ra.new_connections > 0) {
    activityLines.push(`New connections accepted: ${ra.new_connections}`);
  }
  if (ra.invoices_paid.length) {
    activityLines.push(
      `Invoices PAID (${ra.invoices_paid.length}):\n` +
      ra.invoices_paid.map((i) => `  - ${i.invoice_number}: ${i.currency} ${Number(i.total_amount).toFixed(2)} (${fmtDate(i.paid_at)})`).join("\n"),
    );
  }
  if (ra.invoices_sent.length) {
    activityLines.push(
      `Invoices SENT (${ra.invoices_sent.length}):\n` +
      ra.invoices_sent.map((i) => `  - ${i.invoice_number} to ${i.recipient ?? "client"}: ${i.currency} ${Number(i.total_amount).toFixed(2)} (${fmtDate(i.created_at)})`).join("\n"),
    );
  }
  if (ra.unread_notifications > 0) {
    const titles = ra.last_notification_titles.length
      ? ` Recent: ${ra.last_notification_titles.slice(0, 3).map((t) => `"${t}"`).join(", ")}`
      : "";
    activityLines.push(`Unread notifications: ${ra.unread_notifications}.${titles}`);
  }

  if (activityLines.length === 0) {
    parts.push(`NOTHING happened in the last 7 days. No tasks completed, no credits added, no invoices sent or paid, no new connections, no unread notifications. If the user asks "what's new" or "catch me up", be honest that it's been quiet — then suggest ONE concrete next move based on their active projects, drafts, or upcoming events above.`);
  } else {
    parts.push(activityLines.join("\n"));
    parts.push(`When summarising "what's new" / "catch me up", reference these specific items by name (project, invoice number, task title) — never invent or generalise.`);
  }
  parts.push(`=== END RECENT ACTIVITY ===\n`);

  // Surface awareness — tells the model where the user just clicked from.
  if (surface) {
    const surfaceMap: Record<string, string> = {
      desk: "ThriveDesk (project workspace)",
      pay: "ThrivePay (invoices, payments, expenses)",
      match: "Match (find collaborators)",
      gigs: "Gigs (opportunities board)",
      home: "Home feed",
      profile: "Profile / EPK editor",
      credit: "Credits (resume/IMDb-style portfolio)",
      event: "Events / Sessions",
    };
    parts.push(`Currently on surface: ${surfaceMap[surface] ?? surface}.`);
    if (surfaceContext && Object.keys(surfaceContext).length) {
      parts.push(`Surface context: ${JSON.stringify(surfaceContext).slice(0, 400)}.`);
    }
  }

  parts.push(`=== END USER FACTS ===`);
  parts.push(
    `CRITICAL: Treat the facts above as the ONLY ground truth about this user's activity. ` +
    `Do NOT invent projects, applications, payments, amounts, dates, collaborators, or events that are not listed above. ` +
    `If a section says NONE, do not pretend otherwise. ` +
    `If the user asks "catch me up" or "what's new" and there's nothing new in the facts, say so honestly ` +
    `(e.g. "Nothing new since you were last here — want me to suggest a next move?").`,
  );

  return parts.join("\n");
}

/**
 * Helper: get-or-create the user's canonical "Thrive Copilot" thread,
 * so cross-surface chat is one continuous conversation.
 * The thread is identified by title = '__copilot__' (hidden marker).
 */
export async function getOrCreateCopilotThread(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("title", "__copilot__")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from("ai_conversations")
    .insert({ user_id: userId, title: "__copilot__" })
    .select("id")
    .single();
  if (error || !created) throw new Error("Could not create copilot thread");
  return created.id;
}
