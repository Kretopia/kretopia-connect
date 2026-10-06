// send-weekly-matches -- "Your weekly Kretopia matches & opportunities".
//
// Once a week, per active user: up to 3 people who share skills with them,
// up to 3 new opportunities that list a skill they have, and up to 3 new
// Scout findings. Everything comes from existing tables; there is no AI call
// and NO score is shown or invented -- each item says only WHY it is listed
// (the skills it shares with you, where it was found). A user with nothing
// real to show this week gets no email.
//
// Sending rules (same as send-weekly-digest): Resend with the existing
// sender, a working unsubscribe link + List-Unsubscribe header on every
// email, suppression list honoured, per-week dedupe + send log through
// email_send_log, and a time budget so a long list resumes on the next run.
//
// Auth: x-cron-secret (pg_cron) or an admin JWT, via requireAdminOrCron.
// Body (all optional): { preview: true, recipient_email } sends one copy
// to that address; { dry_run: true } counts who WOULD get an email and sends
// nothing; { force: true } ignores this week's already-sent log.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";
import {
  SITE_URL, escapeHtml, currentMondayISO, fetchAllRows, getUnsubscribeToken, skillNames,
} from "../_shared/weeklyEmail.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = adminGuardCorsHeaders;

const FROM = "Kretopia <info@kretopia.com>";
const TEMPLATE_NAME = "weekly-matches"; // email_send_log.template_name
const SUBJECT = "Your weekly Kretopia matches & opportunities";
const TIME_BUDGET_MS = 120_000;
const ACTIVE_WINDOW_DAYS = 60;   // recipients: active in the last 60 days
const REPEAT_WINDOW_DAYS = 28;   // don't show the same item again within 4 weeks
const MAX_PER_SECTION = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  passport_profession: string | null;
  job_title: string | null;
  location: string | null;
  professional_skills: unknown;
  account_type: string | null;
  is_discoverable: boolean | null;
  last_active_date: string | null;
}
interface OppRow {
  id: string; title: string; type: string | null; compensation: string | null; location: string | null;
  skills: string[] | null; created_at: string | null; application_deadline: string | null; created_by: string | null;
}
interface ScoutRow {
  id: string; title: string; company: string | null; location: string | null; remote: boolean | null;
  description: string | null; full_description: string | null; compensation: string | null;
  apply_url: string | null; source: string; source_name: string | null; source_url: string;
  tags: string[] | null; dedupe_key: string; fit_score: number; scouted_at: string;
}
interface Content {
  talent: Array<{ id: string; name: string; headline: string; location: string; shared: string[] }>;
  opportunities: Array<{ id: string; title: string; detail: string; shared: string[] }>;
  scout: Array<{ id: string; title: string; company: string; where: string; source: string }>;
}

const lower = (s: string) => s.toLowerCase();
const sharedWith = (mine: Set<string>, theirs: string[]) => theirs.filter((s) => mine.has(lower(s)));

// Scout's own "thin listing" rule (src/components/opportunity/ScoutedGigsSection.tsx):
// a title-only row or a link to a generic index page is not a real listing.
function isThinListing(g: ScoutRow): boolean {
  const desc = (g.full_description || g.description || "").trim();
  if (desc.length < 40 && !g.compensation && !g.company) return true;
  const url = g.apply_url || g.source_url || "";
  try {
    const u = new URL(url);
    const segs = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const last = (segs[segs.length - 1] || "").toLowerCase();
    const generic = ["jobs", "careers", "search", "browse", "explore", "listings", "opportunities", "gigs", "tags", "postings", "apply", "casting"];
    if (generic.includes(last)) return true;
    if (segs.length < 2 && last.length < 8) return true;
    if (/linkedin\.com$/.test(u.hostname.replace(/^www\./, "")) && !/\/jobs\/view\//.test(u.pathname)) return true;
  } catch { return true; }
  return false;
}

// The welcome flow seeds one sample Scout gig per new user (fake brand, fake
// $ range, fit 88). It must never be presented as a finding.
function isSeededSample(g: ScoutRow): boolean {
  return g.source === "thrivein" || (g.dedupe_key || "").startsWith("demo-") || (g.tags || []).includes("sample");
}

function buildHtml(firstName: string, c: Content, unsubscribeUrl: string): string {
  const card = (inner: string) =>
    `<div style="background: rgba(255,255,255,0.04); border-left: 3px solid #4338CA; padding: 12px 14px; margin-bottom: 8px; border-radius: 8px;">${inner}</div>`;
  const title = (t: string) => `<div style="color: #ffffff; font-weight: 600; font-size: 15px;">${escapeHtml(t)}</div>`;
  const sub = (t: string) => t ? `<div style="color: #a0a0a0; font-size: 13px; margin-top: 3px;">${escapeHtml(t)}</div>` : "";
  const why = (t: string) => `<div style="color: #a5b4fc; font-size: 12px; margin-top: 4px;">${escapeHtml(t)}</div>`;
  const section = (heading: string, body: string, note = "") =>
    `<div style="margin: 28px 0;"><h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px;">${heading}</h3>${body}${note ? `<p style="color: #888; font-size: 12px; margin: 6px 0 0;">${escapeHtml(note)}</p>` : ""}</div>`;
  const button = (href: string, label: string) =>
    `<a href="${href}" style="display: inline-block; margin: 0 6px 8px; padding: 12px 26px; background: linear-gradient(135deg, #4338CA, #6366f1); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">${label}</a>`;

  const talent = c.talent.length
    ? section("🤝 People worth meeting", c.talent.map((t) =>
        `<a href="${SITE_URL}/profile/${t.id}" style="display: block; text-decoration: none;">${card(
          title(t.name) + sub([t.headline, t.location].filter(Boolean).join(" · ")) + why(`Shares your skills: ${t.shared.slice(0, 3).join(", ")}`),
        )}</a>`).join(""))
    : "";
  const opps = c.opportunities.length
    ? section("💼 New opportunities for your skills", c.opportunities.map((o) =>
        `<a href="${SITE_URL}/opportunity/${o.id}" style="display: block; text-decoration: none;">${card(
          title(o.title) + sub(o.detail) + why(`Lists your skills: ${o.shared.slice(0, 3).join(", ")}`),
        )}</a>`).join(""))
    : "";
  const scout = c.scout.length
    ? section("🔭 New from Scout", c.scout.map((s) =>
        card(title(s.title) + sub([s.company, s.where].filter(Boolean).join(" · ")) + why(`Found via ${s.source}`))).join(""),
        "Scout findings come from other websites. Open Scout and check the source before you apply.")
    : "";

  return `
    <div style="font-family: 'Inter', -apple-system, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; padding: 36px 28px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700;">Your weekly matches &amp; opportunities</h1>
        <p style="color: #818cf8; font-size: 12px; margin-top: 6px; text-transform: uppercase; letter-spacing: 2px;">Kretopia</p>
      </div>
      <p style="font-size: 16px; line-height: 1.6; margin: 0 0 8px;">Hey ${escapeHtml(firstName)},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0; margin: 0 0 8px;">Here is what we found for you this week, based on the skills on your profile.</p>
      ${talent}${opps}${scout}
      <div style="text-align: center; margin: 28px 0 8px;">
        ${c.scout.length || c.opportunities.length ? button(`${SITE_URL}/scout`, "Open Scout") : ""}
        ${c.talent.length ? button(`${SITE_URL}/talent-finder`, "Open Talent Finder") : ""}
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 28px; padding-top: 16px; text-align: center;">
        <p style="color: #666; font-size: 12px; margin: 0 0 6px;">You're receiving this weekly email because you have a Kretopia account.</p>
        <p style="color: #666; font-size: 12px; margin: 0;">
          <a href="${unsubscribeUrl}" style="color: #818cf8; text-decoration: underline;">Unsubscribe</a>
          &nbsp;·&nbsp;
          <a href="${SITE_URL}/settings" style="color: #818cf8; text-decoration: none;">Manage email preferences</a>
        </p>
      </div>
    </div>`;
}

function buildText(firstName: string, c: Content, unsubscribeUrl: string): string {
  const lines: string[] = [`Hey ${firstName},`, "", "Here is what we found for you this week, based on the skills on your profile.", ""];
  if (c.talent.length) {
    lines.push("PEOPLE WORTH MEETING");
    for (const t of c.talent) lines.push(`- ${t.name}${t.headline ? ` (${t.headline})` : ""} - shares your skills: ${t.shared.slice(0, 3).join(", ")} - ${SITE_URL}/profile/${t.id}`);
    lines.push("");
  }
  if (c.opportunities.length) {
    lines.push("NEW OPPORTUNITIES FOR YOUR SKILLS");
    for (const o of c.opportunities) lines.push(`- ${o.title} - lists your skills: ${o.shared.slice(0, 3).join(", ")} - ${SITE_URL}/opportunity/${o.id}`);
    lines.push("");
  }
  if (c.scout.length) {
    lines.push("NEW FROM SCOUT (check the source before you apply)");
    for (const s of c.scout) lines.push(`- ${s.title}${s.company ? ` at ${s.company}` : ""} - found via ${s.source}`);
    lines.push(`Open Scout: ${SITE_URL}/scout`, "");
  }
  lines.push(`Unsubscribe: ${unsubscribeUrl}`, `Preferences: ${SITE_URL}/settings`);
  return lines.join("\n");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let body: any = {};
    try { body = await req.json(); } catch { /* cron: no body */ }
    const isPreview = body?.preview === true;
    const dryRun = body?.dry_run === true;
    const force = body?.force === true;

    const startedAt = Date.now();
    const weekAgoIso = new Date(startedAt - 7 * DAY_MS).toISOString();
    const nowIso = new Date(startedAt).toISOString();
    const mondayStart = `${currentMondayISO()}T00:00:00.000Z`;
    const activeSince = new Date(startedAt - ACTIVE_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);

    // ---- loaded once for the whole run ------------------------------------
    const profiles = await fetchAllRows<ProfileRow>((from, to) =>
      admin.from("profiles")
        .select("user_id, full_name, passport_profession, job_title, location, professional_skills, account_type, is_discoverable, last_active_date")
        .eq("onboarding_completed", true).range(from, to));
    const recipients = profiles.filter((p) => p.last_active_date && p.last_active_date >= activeSince);
    // People who can be suggested: public (discoverable), named, not company accounts.
    const pool = profiles
      .filter((p) => p.is_discoverable === true && !!p.full_name && p.account_type !== "company" && !!p.last_active_date && p.last_active_date >= activeSince)
      .map((p) => ({ p, skills: skillNames(p.professional_skills) }))
      .filter((x) => x.skills.length > 0);

    const opps = await fetchAllRows<OppRow>((from, to) =>
      admin.from("opportunities")
        .select("id, title, type, compensation, location, skills, created_at, application_deadline, created_by")
        .in("status", ["active", "open"]).gte("created_at", weekAgoIso).range(from, to));
    const liveOpps = opps.filter((o) => !o.application_deadline || o.application_deadline > nowIso);

    const flagOff = async (table: string, column: string) =>
      new Set((await fetchAllRows<{ user_id: string }>((from, to) =>
        admin.from(table).select("user_id").eq(column, false).range(from, to))).map((r) => r.user_id));
    const noMatchEmails = await flagOff("notification_preferences", "email_matches");
    const noOppEmails = await flagOff("notification_preferences", "email_opportunities");
    const scoutOff = await flagOff("scout_preferences", "enabled");

    const suppressed = new Set(
      (await fetchAllRows<{ email: string }>((from, to) => admin.from("suppressed_emails").select("email").range(from, to)))
        .map((r) => r.email.toLowerCase()));

    // What we already sent (and showed) recently, from the existing send log.
    const logRows = await fetchAllRows<{ recipient_email: string; metadata: any; created_at: string }>((from, to) =>
      admin.from("email_send_log").select("recipient_email, metadata, created_at")
        .eq("template_name", TEMPLATE_NAME).eq("status", "sent")
        .gte("created_at", new Date(startedAt - REPEAT_WINDOW_DAYS * DAY_MS).toISOString()).range(from, to));
    const alreadySent = new Set<string>();
    const shownBefore = new Map<string, Set<string>>(); // email -> item ids from PRIOR weeks
    for (const r of logRows) {
      const e = r.recipient_email.toLowerCase();
      if (r.created_at >= mondayStart) { if (!force) alreadySent.add(e); continue; }
      const ids = [...(r.metadata?.talent_ids || []), ...(r.metadata?.opportunity_ids || []), ...(r.metadata?.scout_ids || [])];
      if (!shownBefore.has(e)) shownBefore.set(e, new Set());
      for (const id of ids) shownBefore.get(e)!.add(String(id));
    }

    const emailById = new Map<string, string>();
    for (let page = 1; page <= 200; page++) {
      const { data: pageData, error: pageError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (pageError || !pageData?.users?.length) break;
      for (const u of pageData.users) if (u.email) emailById.set(u.id, u.email);
      if (pageData.users.length < 1000) break;
    }

    // ---- per-user content -------------------------------------------------
    const contentFor = async (me: ProfileRow, email: string): Promise<Content> => {
      const seen = shownBefore.get(email.toLowerCase()) ?? new Set<string>();
      const mySkills = skillNames(me.professional_skills);
      const mine = new Set(mySkills.map(lower));
      const content: Content = { talent: [], opportunities: [], scout: [] };

      if (!noMatchEmails.has(me.user_id) && mine.size > 0) {
        content.talent = pool
          .filter((x) => x.p.user_id !== me.user_id && !seen.has(x.p.user_id))
          .map((x) => ({ x, shared: sharedWith(mine, x.skills) }))
          .filter((m) => m.shared.length > 0) // a real shared skill, or no suggestion
          .sort((a, b) => b.shared.length - a.shared.length || (b.x.p.last_active_date || "").localeCompare(a.x.p.last_active_date || ""))
          .slice(0, MAX_PER_SECTION)
          .map((m) => ({
            id: m.x.p.user_id,
            name: m.x.p.full_name!,
            headline: m.x.p.passport_profession || m.x.p.job_title || "",
            location: m.x.p.location || "",
            shared: m.shared,
          }));
      }

      if (!noOppEmails.has(me.user_id)) {
        if (mine.size > 0) {
          content.opportunities = liveOpps
            .filter((o) => o.created_by !== me.user_id && !seen.has(o.id))
            .map((o) => ({ o, shared: sharedWith(mine, o.skills || []) }))
            .filter((m) => m.shared.length > 0)
            .sort((a, b) => b.shared.length - a.shared.length || (b.o.created_at || "").localeCompare(a.o.created_at || ""))
            .slice(0, MAX_PER_SECTION)
            .map((m) => ({
              id: m.o.id,
              title: m.o.title,
              detail: [m.o.type, m.o.location, m.o.compensation].filter(Boolean).join(" · "),
              shared: m.shared,
            }));
        }

        if (!scoutOff.has(me.user_id)) {
          const { data: gigs } = await admin.from("scouted_gigs").select("*")
            .eq("target_user_id", me.user_id).gt("expires_at", nowIso).gte("scouted_at", weekAgoIso)
            .order("fit_score", { ascending: false }).order("scouted_at", { ascending: false }).limit(20);
          const candidates = ((gigs || []) as ScoutRow[]).filter((g) => !isSeededSample(g) && !isThinListing(g) && !seen.has(g.id));
          if (candidates.length) {
            const { data: acted } = await admin.from("scouted_gig_actions").select("scouted_gig_id")
              .eq("user_id", me.user_id).in("action", ["dismissed", "applied"]).in("scouted_gig_id", candidates.map((g) => g.id));
            const done = new Set((acted || []).map((a: any) => a.scouted_gig_id));
            content.scout = candidates.filter((g) => !done.has(g.id)).slice(0, MAX_PER_SECTION).map((g) => ({
              id: g.id,
              title: g.title,
              company: g.company || "",
              where: g.remote ? "Remote" : (g.location || ""),
              source: g.source_name || g.source,
            }));
          }
        }
      }
      return content;
    };
    const isEmpty = (c: Content) => !c.talent.length && !c.opportunities.length && !c.scout.length;
    const firstNameOf = (p: ProfileRow) => p.full_name?.split(" ")[0] || "Creative";

    // ---- preview: one copy, to one address, not logged ---------------------
    if (isPreview) {
      const to: string | undefined = body?.recipient_email
        || (!guard.viaCron && guard.userId ? emailById.get(guard.userId) : undefined);
      if (!to) return json({ error: "No recipient" }, 400);
      const me = profiles.find((p) => emailById.get(p.user_id)?.toLowerCase() === to.toLowerCase());
      if (!me) return json({ success: true, preview: true, sent: false, reason: "recipient_has_no_profile" });
      const content = await contentFor(me, to);
      if (isEmpty(content)) return json({ success: true, preview: true, sent: false, reason: "nothing_to_show_this_week" });
      const token = await getUnsubscribeToken(admin, to);
      const unsubscribeUrl = token ? `${SITE_URL}/unsubscribe?token=${token}` : `${SITE_URL}/settings`;
      const { error } = await resend.emails.send({
        from: FROM, to: [to], subject: `[PREVIEW] ${SUBJECT}`,
        html: buildHtml(firstNameOf(me), content, unsubscribeUrl), text: buildText(firstNameOf(me), content, unsubscribeUrl),
      });
      if (error) throw error;
      return json({ success: true, preview: true, sent: true, sent_to: to });
    }

    // ---- full send -----------------------------------------------------------
    let sent = 0, failed = 0, noContent = 0, optedOut = 0, deduped = 0, suppressedCount = 0, noAddress = 0, noToken = 0, wouldSend = 0;
    let timedOut = false;
    const batch: Array<Record<string, unknown>> = [];

    // Flushed in small batches so a runtime kill can't lose the 'sent' rows
    // that make a re-run skip people who already have this week's email.
    const flushLog = async () => {
      if (!batch.length) return;
      const rows = batch.splice(0, batch.length);
      const { error } = await admin.from("email_send_log").insert(rows);
      if (error) console.error("[weekly-matches] could not write send log:", error.message);
    };

    for (const me of recipients) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      // Both flags off -> this email has nothing it is allowed to contain.
      if (noMatchEmails.has(me.user_id) && noOppEmails.has(me.user_id)) { optedOut++; continue; }
      const email = emailById.get(me.user_id);
      if (!email) { noAddress++; continue; }
      const key = email.toLowerCase();
      if (suppressed.has(key)) { suppressedCount++; continue; }
      if (alreadySent.has(key)) { deduped++; continue; }

      const content = await contentFor(me, email);
      if (isEmpty(content)) { noContent++; continue; }
      if (dryRun) { wouldSend++; continue; }

      const token = await getUnsubscribeToken(admin, email);
      if (!token) { noToken++; continue; } // no working unsubscribe link -> no email
      const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${token}`;
      try {
        const { data, error } = await resend.emails.send({
          from: FROM, to: [email], subject: SUBJECT,
          html: buildHtml(firstNameOf(me), content, unsubscribeUrl),
          text: buildText(firstNameOf(me), content, unsubscribeUrl),
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        });
        if (error) throw error;
        sent++;
        batch.push({
          message_id: (data as any)?.id ?? null, template_name: TEMPLATE_NAME, recipient_email: email, status: "sent",
          metadata: {
            talent_ids: content.talent.map((t) => t.id),
            opportunity_ids: content.opportunities.map((o) => o.id),
            scout_ids: content.scout.map((s) => s.id),
          },
        });
      } catch (err) {
        failed++;
        console.error(`[weekly-matches] ${email}:`, err);
        batch.push({ template_name: TEMPLATE_NAME, recipient_email: email, status: "failed", error_message: String((err as any)?.message ?? err).slice(0, 500) });
      }
      if (batch.length >= 25) await flushLog();
      await new Promise((r) => setTimeout(r, 80));
    }
    await flushLog();

    console.log(`[weekly-matches] sent=${sent} failed=${failed} noContent=${noContent} optedOut=${optedOut} deduped=${deduped} suppressed=${suppressedCount} partial=${timedOut} dryRun=${dryRun}`);
    return json({
      success: true, dry_run: dryRun, sent, would_send: dryRun ? wouldSend : undefined, failed,
      no_content: noContent, opted_out: optedOut, already_sent: deduped, suppressed: suppressedCount,
      no_address: noAddress, no_unsubscribe_token: noToken, recipients_considered: recipients.length,
      partial: timedOut, // true -> run again to continue; people already sent are skipped
    });
  } catch (error: any) {
    console.error("[weekly-matches] fatal:", error);
    return json({ error: error?.message ?? String(error) }, 500);
  }
};

serve(handler);
