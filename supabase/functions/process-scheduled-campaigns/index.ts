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
    .map((p: string) => {
      let html = p.replace(/\[image:(https?:\/\/[^\]|]+)(?:\|([^\]]*))?\]/gi, (_m, url, alt) => {
        return `<img src="${url}" alt="${alt || 'Embedded image'}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;" />`;
      });
      html = html.replace(/\[video:(https?:\/\/[^\]|]+)(?:\|([^\]]*))?\]/gi, (_m, url, label) => {
        return `<a href="${url}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #8B5CF6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 8px 0;">▶ ${label || 'Watch Video'}</a>`;
      });
      return `<p style="margin: 0 0 12px 0; color: #333; font-size: 14px; line-height: 1.6;">${html.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[SCHEDULED-CAMPAIGNS] Processing scheduled campaigns...");

    // Find campaigns that are scheduled and due
    const { data: campaigns, error: campError } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString());

    if (campError) throw campError;
    if (!campaigns || campaigns.length === 0) {
      console.log("[SCHEDULED-CAMPAIGNS] No due campaigns found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[SCHEDULED-CAMPAIGNS] Found ${campaigns.length} due campaign(s)`);

    for (const campaign of campaigns) {
      try {
        // Mark as sending
        await supabaseAdmin.from("email_campaigns").update({ status: "sending" }).eq("id", campaign.id);

        // Get pending recipients
        const { data: recipients } = await supabaseAdmin
          .from("campaign_recipients")
          .select("*")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending");

        if (!recipients || recipients.length === 0) {
          await supabaseAdmin.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaign.id);
          continue;
        }

        // Get user's email settings
        const { data: emailSettings } = await supabaseAdmin
          .from("user_email_settings")
          .select("*")
          .eq("user_id", campaign.user_id)
          .maybeSingle();

        // Get sender profile
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", campaign.user_id)
          .single();

        // Get user email for reply-to
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(campaign.user_id);
        const userEmail = authUser?.user?.email;

        const useGmail = emailSettings?.is_configured && emailSettings?.provider === "gmail" && emailSettings?.gmail_email && emailSettings?.gmail_app_password;

        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
          try {
            const personalBody = campaign.body
              .replace(/\{name\}/gi, recipient.name || recipient.email.split("@")[0])
              .replace(/\{email\}/gi, recipient.email);
            const personalSubject = campaign.subject
              .replace(/\{name\}/gi, recipient.name || recipient.email.split("@")[0]);

            const htmlBody = `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
                ${wrapHtml(personalBody)}
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 11px; margin: 0;">Sent via Kretopia</p>
                </div>
              </div>
            `;

            let sendSuccess = false;

            if (useGmail) {
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
                  to: recipient.email,
                  subject: personalSubject,
                  html: htmlBody,
                });
                await client.close();
                sendSuccess = true;
              } catch (e) {
                console.error(`[SCHEDULED-CAMPAIGNS] Gmail failed for ${recipient.email}:`, e);
              }
            }

            if (!sendSuccess && resendApiKey) {
              try {
                const resend = new Resend(resendApiKey);
                await resend.emails.send({
                  from: `${senderProfile?.full_name || "Kretopia User"} via Kretopia <info@kretopia.com>`,
                  to: [recipient.email],
                  subject: personalSubject,
                  html: htmlBody,
                  replyTo: userEmail || undefined,
                });
                sendSuccess = true;
              } catch (e) {
                console.error(`[SCHEDULED-CAMPAIGNS] Resend failed for ${recipient.email}:`, e);
              }
            }

            if (sendSuccess) {
              sent++;
              await supabaseAdmin.from("campaign_recipients").update({
                status: "sent",
                sent_at: new Date().toISOString(),
              }).eq("id", recipient.id);
            } else {
              failed++;
              await supabaseAdmin.from("campaign_recipients").update({
                status: "failed",
                error_message: "All send methods failed",
              }).eq("id", recipient.id);
            }

            // Rate limit delay
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (e) {
            failed++;
            console.error(`[SCHEDULED-CAMPAIGNS] Error sending to ${recipient.email}:`, e);
            await supabaseAdmin.from("campaign_recipients").update({
              status: "failed",
              error_message: e instanceof Error ? e.message : "Unknown error",
            }).eq("id", recipient.id);
          }
        }

        // Update campaign stats
        await supabaseAdmin.from("email_campaigns").update({
          status: "sent",
          sent_count: sent,
          failed_count: failed,
          sent_at: new Date().toISOString(),
        }).eq("id", campaign.id);

        // Update monthly usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: usage } = await supabaseAdmin
          .from("bulk_email_usage")
          .select("send_count")
          .eq("user_id", campaign.user_id)
          .eq("month", currentMonth)
          .maybeSingle();

        await supabaseAdmin.from("bulk_email_usage").upsert({
          user_id: campaign.user_id,
          month: currentMonth,
          send_count: (usage?.send_count || 0) + sent,
        }, { onConflict: "user_id,month" });

        console.log(`[SCHEDULED-CAMPAIGNS] Campaign ${campaign.id}: ${sent} sent, ${failed} failed`);
      } catch (e) {
        console.error(`[SCHEDULED-CAMPAIGNS] Failed to process campaign ${campaign.id}:`, e);
        await supabaseAdmin.from("email_campaigns").update({ status: "failed" }).eq("id", campaign.id);
      }
    }

    return new Response(JSON.stringify({ processed: campaigns.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[SCHEDULED-CAMPAIGNS] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
