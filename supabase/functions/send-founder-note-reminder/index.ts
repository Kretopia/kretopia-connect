import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = adminGuardCorsHeaders;

const baseUrl = "https://www.thrivein.io";

// Sends a Sunday reminder email to all admins to write the weekly founder note.
// Triggered by pg_cron Sundays at 18:00 UTC. Also callable by admins for preview.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);


    // Get all admin user IDs
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No admins" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute upcoming Monday
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 1 ? 0 : (1 - day + 7) % 7 || 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
    const mondayLabel = monday.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    // Check if note already exists for this week
    const { data: existingNote } = await supabaseAdmin
      .from("weekly_founder_notes")
      .select("id, title")
      .eq("week_start_date", monday.toISOString().slice(0, 10))
      .maybeSingle();

    let success = 0, errors = 0;
    for (const admin of admins) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(admin.user_id);
      const email = userData?.user?.email;
      if (!email) continue;

      const html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 32px; border-radius: 16px;">
          <h1 style="font-size: 22px; margin: 0 0 8px; color: #fff;">📝 Time for your Sunday Note</h1>
          <p style="color: #a0a0a0; font-size: 13px; margin: 0 0 24px;">Tomorrow morning the Monday Drop ships to thousands of Thrivers.</p>

          ${existingNote ? `
            <div style="background: rgba(74, 222, 128, 0.1); border-left: 3px solid #4ade80; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
              <div style="color: #4ade80; font-weight: 600; font-size: 14px;">✓ Note already saved for ${mondayLabel}</div>
              ${existingNote.title ? `<div style="color: #e0e0e0; font-size: 13px; margin-top: 4px;">"${existingNote.title}"</div>` : ""}
              <div style="color: #a0a0a0; font-size: 12px; margin-top: 6px;">You can still update it before 11 PM UTC tonight.</div>
            </div>
          ` : `
            <div style="background: rgba(251, 191, 36, 0.1); border-left: 3px solid #fbbf24; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
              <div style="color: #fbbf24; font-weight: 600; font-size: 14px;">⚠ No note yet for ${mondayLabel}</div>
              <div style="color: #a0a0a0; font-size: 12px; margin-top: 6px;">Write your message before tonight 11 PM UTC.</div>
            </div>
          `}

          <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">A few prompts for this week's note:</p>
          <ul style="color: #a0a0a0; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>What shipped or what's launching?</li>
            <li>One thing you're proud of from a Thriver</li>
            <li>What you need help with / community ask</li>
            <li>A short personal reflection</li>
          </ul>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${baseUrl}/admin/weekly-note" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #4338CA, #6366f1); color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600;">${existingNote ? "Edit your note →" : "Write your note →"}</a>
          </div>

          <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">Cron: Sun 18:00 UTC · Monday digest sends Mon 09:00 UTC</p>
        </div>
      `;

      const { error } = await resend.emails.send({
        from: "Kretopia <info@kretopia.com>",
        to: [email],
        subject: existingNote ? `📝 Reminder: Monday note ready (${mondayLabel})` : `⏰ Write your Monday note for ${mondayLabel}`,
        html,
      });
      if (error) { errors++; console.error(`[reminder] ${email}:`, error); }
      else success++;
    }

    return new Response(
      JSON.stringify({ success: true, sent: success, errors, has_note: !!existingNote }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[reminder] fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
