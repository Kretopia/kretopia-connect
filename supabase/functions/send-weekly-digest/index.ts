import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));



const baseUrl = "https://www.kretopia.com";
const FROM = "Kretopia <noreply@kretopia.com>";
const TEMPLATE_NAME = "weekly-update"; // email_send_log.template_name for this email
const TIME_BUDGET_MS = 120_000; // stop before the edge runtime limit; a re-run resumes

// PostgREST returns at most 1000 rows per request; page through the rest.
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// One unsubscribe token per address, same scheme as send-transactional-email
// (email_unsubscribe_tokens + the /unsubscribe page). Returns null when the
// address already used its token or no token can be stored: this email is
// never sent without a working unsubscribe link.
async function getUnsubscribeToken(admin: any, email: string): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing, error } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error) return null;
  if (existing) return existing.used_at ? null : existing.token;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error: upsertError } = await admin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  if (upsertError) return null;
  const { data: stored } = await admin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return stored?.token ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphify(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p style="margin: 0 0 14px; color: #e0e0e0; font-size: 15px; line-height: 1.65;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function getCurrentMondayISO(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = adminGuardCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* GET / cron */ }
    const isPreview = body?.preview === true;
    const previewRecipient: string | undefined = body?.recipient_email;
    const callerUserId: string | null = guard.viaCron ? null : guard.userId;


    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const mondayISO = getCurrentMondayISO();

    // === GATHER CONTENT BLOCKS ===

    // 1. Founder note for this week (or most recent)
    const { data: founderNote } = await supabaseAdmin
      .from("weekly_founder_notes")
      .select("title, body, week_start_date")
      .eq("is_published", true)
      .lte("week_start_date", mondayISO)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Latest magazine articles (most recent published, top 4 — no date cutoff so digest always has content)
    const { data: articles } = await supabaseAdmin
      .from("magazine_articles")
      .select("id, slug, title, subtitle, cover_image_url, category, read_time_minutes, author_name")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(4);

    // 3. Top paid gigs (last 7 days, open)
    const { data: gigs } = await supabaseAdmin
      .from("opportunities")
      .select("id, title, type, budget_range, location")
      .gte("created_at", weekAgo)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5);

    // 4. Newest member with a public profile (labelled "New to Kretopia" -- this
    //    is the most recent signup, not a curated or ranked pick)
    const { data: newestMember } = await supabaseAdmin
      .from("public_profiles_safe")
      .select("user_id, full_name, site_headline, avatar_url, role")
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Upcoming events
    const { data: events } = await supabaseAdmin
      .from("creative_jams")
      .select("id, title, start_time, venue_name")
      .gte("start_time", nowIso)
      .eq("is_public", true)
      .order("start_time", { ascending: true })
      .limit(3);

    // 6. Platform stats (last 7 days)
    const [{ count: newUsers }, { count: newGigs }, { count: newCredits }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabaseAdmin.from("opportunities").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabaseAdmin.from("credits").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    ]);

    // === BUILD HTML SECTIONS ===

    const founderSection = founderNote
      ? `
        <div style="background: linear-gradient(135deg, rgba(67,56,202,0.15), rgba(99,102,241,0.08)); border-left: 4px solid #6366f1; padding: 20px 22px; margin: 24px 0; border-radius: 12px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a5b4fc; font-weight: 600; margin-bottom: 8px;">📝 Note from the Founder</div>
          ${founderNote.title ? `<h3 style="color: #ffffff; font-size: 20px; margin: 0 0 12px; line-height: 1.3;">${escapeHtml(founderNote.title)}</h3>` : ""}
          ${paragraphify(founderNote.body)}
          <p style="color: #818cf8; font-size: 13px; margin: 12px 0 0; font-style: italic;">— Ethan, Founder of Kretopia</p>
        </div>
      `
      : "";

    const articlesSection = articles && articles.length > 0
      ? `
        <div style="margin: 28px 0;">
          <h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px;">📰 From the Magazine</h3>
          ${articles.map((a) => `
            <a href="${baseUrl}/magazine/${a.slug || a.id}" style="display: block; text-decoration: none; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
              ${a.cover_image_url ? `<img src="${a.cover_image_url}" alt="" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />` : ""}
              ${a.category ? `<div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #818cf8; margin-bottom: 4px;">${escapeHtml(a.category)}</div>` : ""}
              <div style="color: #ffffff; font-weight: 600; font-size: 16px; line-height: 1.3; margin-bottom: 4px;">${escapeHtml(a.title)}</div>
              ${a.subtitle ? `<div style="color: #a0a0a0; font-size: 13px; line-height: 1.4;">${escapeHtml(a.subtitle)}</div>` : ""}
              <div style="color: #666; font-size: 12px; margin-top: 8px;">${a.author_name ? `By ${escapeHtml(a.author_name)} · ` : ""}${a.read_time_minutes || 3} min read</div>
            </a>
          `).join("")}
        </div>
      `
      : "";

    const gigsSection = gigs && gigs.length > 0
      ? `
        <div style="margin: 28px 0;">
          <h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px;">💼 New Opportunities This Week</h3>
          ${gigs.map((g) => `
            <a href="${baseUrl}/opportunity/${g.id}" style="display: block; text-decoration: none; background: rgba(255,255,255,0.04); border-left: 3px solid #4338CA; padding: 12px 14px; margin-bottom: 8px; border-radius: 8px;">
              <div style="color: #ffffff; font-weight: 600; font-size: 15px;">${escapeHtml(g.title)}</div>
              <div style="color: #a0a0a0; font-size: 13px; margin-top: 3px;">
                ${g.budget_range ? `<span style="color: #4ade80;">${escapeHtml(g.budget_range)}</span>` : ""}
                ${g.location ? ` · ${escapeHtml(g.location)}` : ""}
                ${g.type ? ` · ${escapeHtml(g.type)}` : ""}
              </div>
            </a>
          `).join("")}
        </div>
      `
      : "";

    const featuredSection = newestMember
      ? `
        <div style="margin: 28px 0; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 18px; text-align: center;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #fbbf24; font-weight: 600; margin-bottom: 12px;">⭐ New to Kretopia</div>
          ${newestMember.avatar_url ? `<img src="${newestMember.avatar_url}" alt="" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block;" />` : ""}
          <div style="color: #ffffff; font-size: 17px; font-weight: 600;">${escapeHtml(newestMember.full_name || "")}</div>
          ${newestMember.site_headline ? `<div style="color: #a0a0a0; font-size: 13px; margin-top: 4px;">${escapeHtml(newestMember.site_headline)}</div>` : ""}
          <a href="${baseUrl}/profile/${newestMember.user_id}" style="display: inline-block; margin-top: 12px; padding: 8px 18px; background: rgba(99,102,241,0.2); color: #a5b4fc; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 500;">View profile →</a>
        </div>
      `
      : "";

    const eventsSection = events && events.length > 0
      ? `
        <div style="margin: 28px 0;">
          <h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px;">🎪 Upcoming Events</h3>
          <ul style="padding: 0; margin: 0; list-style: none;">
            ${events.map((e) => {
              const d = new Date(e.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return `<li style="color: #e0e0e0; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px;"><strong style="color: #fff;">${escapeHtml(e.title)}</strong> · ${d}${e.venue_name ? ` · ${escapeHtml(e.venue_name)}` : ""}</li>`;
            }).join("")}
          </ul>
        </div>
      `
      : "";

    const statsSection = `
      <div style="margin: 28px 0; background: rgba(67,56,202,0.08); border-radius: 12px; padding: 18px; text-align: center;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a5b4fc; font-weight: 600; margin-bottom: 12px;">📊 Kretopia This Week</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: center; padding: 4px;">
              <div style="color: #ffffff; font-size: 22px; font-weight: 700;">${newUsers || 0}</div>
              <div style="color: #a0a0a0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">New Members</div>
            </td>
            <td style="text-align: center; padding: 4px;">
              <div style="color: #ffffff; font-size: 22px; font-weight: 700;">${newGigs || 0}</div>
              <div style="color: #a0a0a0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Gigs Posted</div>
            </td>
            <td style="text-align: center; padding: 4px;">
              <div style="color: #ffffff; font-size: 22px; font-weight: 700;">${newCredits || 0}</div>
              <div style="color: #a0a0a0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Credits Added</div>
            </td>
          </tr>
        </table>
      </div>
    `;

    const buildEmailHtml = (greetingName: string, unsubscribeUrl: string) => `
      <div style="font-family: 'Inter', -apple-system, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; padding: 36px 28px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700;">This week at Kretopia</h1>
          <p style="color: #818cf8; font-size: 12px; margin-top: 6px; text-transform: uppercase; letter-spacing: 2px;">Kretopia · The Creative OS</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 8px;">Hey ${escapeHtml(greetingName)},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0; margin: 0 0 16px;">Your weekly hit of opportunities, stories, and what's moving on the platform.</p>
        ${founderSection}
        ${gigsSection}
        ${articlesSection}
        ${featuredSection}
        ${eventsSection}
        ${statsSection}
        <div style="text-align: center; margin: 32px 0 12px;">
          <a href="${baseUrl}/" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #4338CA, #6366f1); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Open Today →</a>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 28px; padding-top: 16px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0 0 6px;">You're receiving this weekly update because you have a Kretopia account or subscribed to our newsletter.</p>
          <p style="color: #666; font-size: 12px; margin: 0;">
            <a href="${unsubscribeUrl}" style="color: #818cf8; text-decoration: underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="${baseUrl}/settings" style="color: #818cf8; text-decoration: none;">Manage email preferences</a>
          </p>
        </div>
      </div>
    `;

    const subjectLine = `This week at Kretopia${founderNote?.title ? ` — ${founderNote.title}` : ""}`;

    // === PREVIEW MODE: send single email to caller ===
    if (isPreview) {
      const recipient = previewRecipient || (callerUserId ? (await supabaseAdmin.auth.admin.getUserById(callerUserId)).data.user?.email : null);
      if (!recipient) {
        return new Response(JSON.stringify({ error: "No recipient" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Look up recipient's first name from profiles (same as full send)
      let previewName = "Creative";
      const { data: recipientUser } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = recipientUser?.users?.find((u: any) => u.email?.toLowerCase() === recipient.toLowerCase());
      if (matchedUser) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", matchedUser.id)
          .maybeSingle();
        if (prof?.full_name) previewName = prof.full_name.split(" ")[0];
      }
      // A preview is not logged or deduped, and goes out even to a suppressed
      // address (it is the admin looking at their own copy); the unsubscribe
      // link falls back to preferences if no token can be made.
      const previewToken = await getUnsubscribeToken(supabaseAdmin, recipient);
      const { error } = await resend.emails.send({
        from: FROM,
        to: [recipient],
        subject: `[PREVIEW] ${subjectLine}`,
        html: buildEmailHtml(previewName, previewToken ? `${baseUrl}/unsubscribe?token=${previewToken}` : `${baseUrl}/settings`),
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, preview: true, sent_to: recipient }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === FULL SEND: opted-in users + newsletter subscribers ===
    const startedAt = Date.now();
    const force = body?.force === true; // re-send even to people who already got this week's update

    const profiles = await fetchAllRows<{ user_id: string; full_name: string | null }>((from, to) =>
      supabaseAdmin.from("profiles").select("user_id, full_name").eq("onboarding_completed", true).range(from, to));
    const subscribers = await fetchAllRows<{ email: string }>((from, to) =>
      supabaseAdmin.from("newsletter_subscribers").select("email").eq("is_active", true).range(from, to));

    // Looked up once, not per person: users who turned this email off,
    // addresses on the suppression list (unsubscribed, bounced, complained),
    // and addresses that already got THIS week's update.
    const optedOut = new Set(
      (await fetchAllRows<{ user_id: string }>((from, to) =>
        supabaseAdmin.from("notification_preferences").select("user_id").eq("email_opportunities", false).range(from, to)))
        .map((r) => r.user_id),
    );
    const suppressed = new Set(
      (await fetchAllRows<{ email: string }>((from, to) =>
        supabaseAdmin.from("suppressed_emails").select("email").range(from, to)))
        .map((r) => r.email.toLowerCase()),
    );
    const alreadySent = force
      ? new Set<string>()
      : new Set(
          (await fetchAllRows<{ recipient_email: string }>((from, to) =>
            supabaseAdmin.from("email_send_log").select("recipient_email")
              .eq("template_name", TEMPLATE_NAME).eq("status", "sent")
              .gte("created_at", `${mondayISO}T00:00:00.000Z`).range(from, to)))
            .map((r) => r.recipient_email.toLowerCase()),
        );

    let success = 0, errors = 0, skipped = 0, deduped = 0, suppressedCount = 0;
    let timedOut = false;
    const seen = new Set<string>();
    const logRows: Array<Record<string, unknown>> = [];

    // Send log (existing email_send_log). Flushed in small batches so a runtime
    // kill can't lose it: the 'sent' rows are what make a re-run skip people who
    // already have this week's update. Best effort -- a logging failure must
    // not hide that the emails went out.
    const flushLog = async () => {
      if (!logRows.length) return;
      const batch = logRows.splice(0, logRows.length);
      const { error: logError } = await supabaseAdmin.from("email_send_log").insert(batch);
      if (logError) console.error("[weekly-update] could not write send log:", logError.message);
    };

    // user id -> email, from the auth list in pages (one request per 1000 users
    // instead of one per user); anything missing falls back to a single lookup.
    const emailById = new Map<string, string>();
    for (let page = 1; page <= 200; page++) {
      const { data: pageData, error: pageError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (pageError || !pageData?.users?.length) break;
      for (const u of pageData.users) if (u.email) emailById.set(u.id, u.email);
      if (pageData.users.length < 1000) break;
    }

    const deliver = async (email: string, firstName: string) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      if (suppressed.has(key)) { suppressedCount++; return; }
      if (alreadySent.has(key)) { deduped++; return; }

      const token = await getUnsubscribeToken(supabaseAdmin, email);
      if (!token) { skipped++; return; } // no working unsubscribe link -> no email
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${token}`;
      try {
        const { data, error } = await resend.emails.send({
          from: FROM,
          to: [email],
          subject: subjectLine,
          html: buildEmailHtml(firstName, unsubscribeUrl),
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        });
        if (error) {
          errors++;
          console.error(`[weekly-update] ${email}:`, error);
          logRows.push({ template_name: TEMPLATE_NAME, recipient_email: email, status: "failed", error_message: String((error as any)?.message ?? error).slice(0, 500) });
        } else {
          success++;
          logRows.push({ message_id: (data as any)?.id ?? null, template_name: TEMPLATE_NAME, recipient_email: email, status: "sent" });
        }
      } catch (err) {
        errors++;
        console.error(`[weekly-update] ${email}:`, err);
        logRows.push({ template_name: TEMPLATE_NAME, recipient_email: email, status: "failed", error_message: String((err as any)?.message ?? err).slice(0, 500) });
      }
      if (logRows.length >= 25) await flushLog();
      await new Promise((r) => setTimeout(r, 80));
    };

    // Platform users who have not turned this email off
    for (const profile of profiles) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      if (optedOut.has(profile.user_id)) { skipped++; continue; }
      try {
        const email = emailById.get(profile.user_id)
          ?? (await supabaseAdmin.auth.admin.getUserById(profile.user_id)).data?.user?.email;
        if (email) await deliver(email, profile.full_name?.split(" ")[0] || "Creative");
      } catch (err) { errors++; console.error(`[weekly-update] user ${profile.user_id}:`, err); }
    }

    // Newsletter subscribers who are not platform users
    for (const sub of subscribers) {
      if (timedOut || Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      await deliver(sub.email, "Creative");
    }

    await flushLog();

    console.log(`[weekly-update] sent=${success} errors=${errors} skipped=${skipped} deduped=${deduped} suppressed=${suppressedCount} partial=${timedOut} unique=${seen.size}`);

    return new Response(
      JSON.stringify({
        success: true, sent: success, failed: errors, skipped, already_sent: deduped,
        suppressed: suppressedCount, unique_recipients: seen.size,
        partial: timedOut, // true -> run again to continue; people already sent are skipped
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[monday-digest] fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
