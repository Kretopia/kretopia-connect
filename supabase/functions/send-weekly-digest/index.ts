import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = adminGuardCorsHeaders;


const baseUrl = "https://www.thrivein.io";

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

    // 4. Featured Thriver — most credits added in last 30 days
    const { data: featuredThriver } = await supabaseAdmin
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
          <h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px;">💼 Top Gigs This Week</h3>
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

    const featuredSection = featuredThriver
      ? `
        <div style="margin: 28px 0; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 18px; text-align: center;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #fbbf24; font-weight: 600; margin-bottom: 12px;">⭐ Featured Thriver</div>
          ${featuredThriver.avatar_url ? `<img src="${featuredThriver.avatar_url}" alt="" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block;" />` : ""}
          <div style="color: #ffffff; font-size: 17px; font-weight: 600;">${escapeHtml(featuredThriver.full_name || "")}</div>
          ${featuredThriver.site_headline ? `<div style="color: #a0a0a0; font-size: 13px; margin-top: 4px;">${escapeHtml(featuredThriver.site_headline)}</div>` : ""}
          <a href="${baseUrl}/profile/${featuredThriver.user_id}" style="display: inline-block; margin-top: 12px; padding: 8px 18px; background: rgba(99,102,241,0.2); color: #a5b4fc; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 500;">View profile →</a>
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
              <div style="color: #a0a0a0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">New Thrivers</div>
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

    const buildEmailHtml = (greetingName: string) => `
      <div style="font-family: 'Inter', -apple-system, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; padding: 36px 28px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700;">Monday Drop 🎯</h1>
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
          <a href="${baseUrl}/discover" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #4338CA, #6366f1); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Open Kretopia →</a>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 28px; padding-top: 16px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            <a href="${baseUrl}/notification-settings" style="color: #818cf8; text-decoration: none;">Manage email preferences</a>
          </p>
        </div>
      </div>
    `;

    const subjectLine = `Monday Drop 🎯 ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}${founderNote?.title ? ` — ${founderNote.title}` : ""}`;

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
      const { error } = await resend.emails.send({
        from: "Kretopia <info@kretopia.com>",
        to: [recipient],
        subject: `[PREVIEW] ${subjectLine}`,
        html: buildEmailHtml(previewName),
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, preview: true, sent_to: recipient }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === FULL SEND: opted-in users + newsletter subscribers ===
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .eq("onboarding_completed", true);

    const { data: subscribers } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    let success = 0, errors = 0, skipped = 0;
    const sentEmails = new Set<string>();

    // Send to platform users (check opt-in)
    for (const profile of profiles || []) {
      try {
        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("email_opportunities")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        if (prefs && prefs.email_opportunities === false) { skipped++; continue; }

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        const email = userData?.user?.email;
        if (!email || sentEmails.has(email.toLowerCase())) continue;
        sentEmails.add(email.toLowerCase());

        const { error } = await resend.emails.send({
          from: "Kretopia <info@kretopia.com>",
          to: [email],
          subject: subjectLine,
          html: buildEmailHtml(profile.full_name?.split(" ")[0] || "Creative"),
        });
        if (error) { errors++; console.error(`[monday] ${email}:`, error); }
        else success++;
        await new Promise((r) => setTimeout(r, 80));
      } catch (err) { errors++; console.error(`[monday] user ${profile.user_id}:`, err); }
    }

    // Newsletter subscribers (not in platform)
    for (const sub of subscribers || []) {
      const e = sub.email.toLowerCase();
      if (sentEmails.has(e)) continue;
      sentEmails.add(e);
      try {
        const { error } = await resend.emails.send({
          from: "Kretopia <info@kretopia.com>",
          to: [sub.email],
          subject: subjectLine,
          html: buildEmailHtml("Creative"),
        });
        if (error) { errors++; } else success++;
        await new Promise((r) => setTimeout(r, 80));
      } catch (err) { errors++; console.error(`[monday] sub ${sub.email}:`, err); }
    }

    console.log(`[monday-digest] sent=${success} errors=${errors} skipped=${skipped} unique=${sentEmails.size}`);

    return new Response(
      JSON.stringify({ success: true, sent: success, failed: errors, skipped, unique_recipients: sentEmails.size }),
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
