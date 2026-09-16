import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function wrapHtml(body: string): string {
  return body
    .split("\n\n")
    .map((p: string) => `<p style="margin: 0 0 12px 0; color: #333; font-size: 14px; line-height: 1.6;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[OUTREACH-QUEUE] Processing daily outreach queue...");

    // Find all active sequences that have pending emails with scheduled_for <= now
    // Also find pending emails where scheduled_for is set based on delay_days from the last sent email
    const { data: activeSequences, error: seqError } = await supabaseAdmin
      .from("outreach_sequences")
      .select("*")
      .eq("status", "active");

    if (seqError) throw seqError;
    if (!activeSequences || activeSequences.length === 0) {
      console.log("[OUTREACH-QUEUE] No active sequences");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalErrors = 0;

    for (const seq of activeSequences) {
      try {
        // Get recipient email
        let recipientEmail = seq.recipient_email;
        if (!recipientEmail && seq.lead_id) {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("email")
            .eq("id", seq.lead_id)
            .single();
          recipientEmail = lead?.email;
        }

        if (!recipientEmail) continue;

        // Get the last sent email to calculate delay
        const { data: sentEmails } = await supabaseAdmin
          .from("sequence_emails")
          .select("sent_at, step_number")
          .eq("sequence_id", seq.id)
          .eq("status", "sent")
          .order("step_number", { ascending: false })
          .limit(1);

        const lastSentAt = sentEmails?.[0]?.sent_at;

        // Get next pending email
        const { data: pendingEmails } = await supabaseAdmin
          .from("sequence_emails")
          .select("*")
          .eq("sequence_id", seq.id)
          .eq("status", "pending")
          .order("step_number", { ascending: true })
          .limit(1);

        if (!pendingEmails || pendingEmails.length === 0) {
          // All emails sent, mark sequence complete
          await supabaseAdmin
            .from("outreach_sequences")
            .update({ status: "completed" })
            .eq("id", seq.id);
          continue;
        }

        const nextEmail = pendingEmails[0];

        // Check if enough days have passed since last send
        if (lastSentAt && nextEmail.delay_days > 0) {
          const lastSent = new Date(lastSentAt);
          const dueDate = new Date(lastSent.getTime() + nextEmail.delay_days * 24 * 60 * 60 * 1000);
          if (new Date() < dueDate) {
            console.log(`[OUTREACH-QUEUE] Sequence ${seq.id} step ${nextEmail.step_number}: not due yet (due ${dueDate.toISOString()})`);
            continue;
          }
        }

        // If this is the first email and sequence was just activated, check if first step has delay
        if (!lastSentAt && nextEmail.step_number === 1 && nextEmail.delay_days > 0) {
          const seqCreated = new Date(seq.created_at);
          const dueDate = new Date(seqCreated.getTime() + nextEmail.delay_days * 24 * 60 * 60 * 1000);
          if (new Date() < dueDate) continue;
        }

        // Get user's email settings
        const { data: emailSettings } = await supabaseAdmin
          .from("user_email_settings")
          .select("*")
          .eq("user_id", seq.user_id)
          .maybeSingle();

        // Get sender profile
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, role")
          .eq("user_id", seq.user_id)
          .single();

        const htmlBody = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
            ${wrapHtml(nextEmail.body)}
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 11px; margin: 0;">Sent via Kretopia</p>
            </div>
          </div>
        `;

        let sendSuccess = false;

        // Try Gmail first if configured
        if (emailSettings?.is_configured && emailSettings?.gmail_email && emailSettings?.gmail_app_password) {
          try {
            const client = new SMTPClient({
              connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                  username: emailSettings.gmail_email,
                  password: emailSettings.gmail_app_password,
                },
              },
            });

            await client.send({
              from: emailSettings.gmail_email,
              to: recipientEmail,
              subject: nextEmail.subject,
              html: htmlBody,
            });

            await client.close();
            sendSuccess = true;
            console.log(`[OUTREACH-QUEUE] Sent via Gmail: ${seq.id} step ${nextEmail.step_number} to ${recipientEmail}`);
          } catch (e) {
            console.error(`[OUTREACH-QUEUE] Gmail failed for ${seq.id}:`, e);
          }
        }

        // Fall back to Resend
        if (!sendSuccess && resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            // Get user email for reply-to
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(seq.user_id);
            
            await resend.emails.send({
              from: `${senderProfile?.full_name || "Kretopia User"} via Kretopia <info@kretopia.com>`,
              to: [recipientEmail],
              subject: nextEmail.subject,
              html: htmlBody,
              replyTo: authUser?.user?.email || undefined,
            });
            sendSuccess = true;
            console.log(`[OUTREACH-QUEUE] Sent via Resend: ${seq.id} step ${nextEmail.step_number} to ${recipientEmail}`);
          } catch (e) {
            console.error(`[OUTREACH-QUEUE] Resend failed for ${seq.id}:`, e);
          }
        }

        if (sendSuccess) {
          // Mark email as sent
          await supabaseAdmin
            .from("sequence_emails")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", nextEmail.id);

          // Update sequence progress
          await supabaseAdmin
            .from("outreach_sequences")
            .update({ completed_steps: (seq.completed_steps || 0) + 1 })
            .eq("id", seq.id);

          // Update lead
          if (seq.lead_id) {
            await supabaseAdmin
              .from("leads")
              .update({ last_contacted_at: new Date().toISOString() })
              .eq("id", seq.lead_id);
          }

          totalSent++;
        } else {
          totalErrors++;
          console.error(`[OUTREACH-QUEUE] No email provider available for user ${seq.user_id}`);
        }
      } catch (e) {
        totalErrors++;
        console.error(`[OUTREACH-QUEUE] Error processing sequence ${seq.id}:`, e);
      }
    }

    console.log(`[OUTREACH-QUEUE] Done. Sent: ${totalSent}, Errors: ${totalErrors}`);

    return new Response(JSON.stringify({ processed: totalSent, errors: totalErrors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[OUTREACH-QUEUE] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
