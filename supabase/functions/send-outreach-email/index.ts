import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailSettings {
  provider: string;
  gmail_email: string | null;
  gmail_app_password: string | null;
  is_configured: boolean;
}

async function sendViaGmail(settings: EmailSettings, to: string, subject: string, htmlBody: string, replyTo?: string): Promise<{ success: boolean; error?: string }> {
  if (!settings.gmail_email || !settings.gmail_app_password) {
    return { success: false, error: "Gmail not configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: settings.gmail_email,
          password: settings.gmail_app_password,
        },
      },
    });

    await client.send({
      from: settings.gmail_email,
      to: to,
      subject: subject,
      content: htmlBody,
      html: htmlBody,
    });

    await client.close();
    return { success: true };
  } catch (e) {
    console.error("Gmail SMTP error:", e);
    return { success: false, error: e instanceof Error ? e.message : "SMTP send failed" };
  }
}

async function sendViaResend(resendApiKey: string, from: string, to: string, subject: string, htmlBody: string, replyTo: string): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const resend = new Resend(resendApiKey);
  const { data: emailResult, error: emailError } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html: htmlBody,
    replyTo,
  });

  if (emailError) {
    return { success: false, error: emailError.message };
  }
  return { success: true, emailId: emailResult?.id };
}

function wrapHtml(body: string): string {
  return body
    .split("\n\n")
    .map((p: string) => {
      // Render inline images: [image:URL] or [image:URL|alt text]
      let html = p.replace(/\[image:(https?:\/\/[^\]|]+)(?:\|([^\]]*))?\]/gi, (_m, url, alt) => {
        return `<img src="${url}" alt="${alt || 'Embedded image'}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;" />`;
      });
      // Render video links: [video:URL] or [video:URL|label]
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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await (userClient.auth as any).getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");

    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    const body = await req.json();
    const { action } = body;

    // Get sender profile
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role, bio, professional_skills")
      .eq("user_id", user.id)
      .single();

    // Get user's email settings
    const { data: emailSettings } = await supabaseAdmin
      .from("user_email_settings")
      .select("provider, gmail_email, gmail_app_password, is_configured")
      .eq("user_id", user.id)
      .maybeSingle();

    const useGmail = emailSettings?.is_configured && emailSettings?.provider === "gmail" && emailSettings?.gmail_email && emailSettings?.gmail_app_password;

    // Helper to send an email using the user's preferred method
    async function sendEmail(to: string, subject: string, rawBody: string): Promise<{ success: boolean; emailId?: string; error?: string }> {
      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px;">
          ${wrapHtml(rawBody)}
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 11px; margin: 0;">Sent via Kretopia</p>
          </div>
        </div>
      `;

      if (useGmail) {
        return sendViaGmail(emailSettings as EmailSettings, to, subject, htmlBody);
      }

      if (!resendApiKey) throw new Error("No email provider configured. Please connect your Gmail in Outreach settings.");

      return sendViaResend(
        resendApiKey,
        `${senderProfile?.full_name || "Kretopia User"} via Kretopia <info@kretopia.com>`,
        to,
        subject,
        htmlBody,
        user.email!
      );
    }

    // ===== ACTION: Test Gmail connection =====
    if (action === "test_gmail") {
      const { gmail_email, gmail_app_password } = body;
      if (!gmail_email || !gmail_app_password) throw new Error("Missing Gmail credentials");

      try {
        const client = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: {
              username: gmail_email,
              password: gmail_app_password,
            },
          },
        });

        // Send a test email to themselves
        await client.send({
          from: gmail_email,
          to: gmail_email,
          subject: "Kretopia Outreach - Connection Test ✓",
          html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Gmail Connected!</h2><p>Your Gmail is now connected to Kretopia Outreach. Emails will be sent from <strong>${gmail_email}</strong>.</p></div>`,
        });

        await client.close();

        // Save settings
        await supabaseAdmin
          .from("user_email_settings")
          .upsert({
            user_id: user.id,
            provider: "gmail",
            gmail_email,
            gmail_app_password,
            is_configured: true,
            last_tested_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        return new Response(JSON.stringify({ success: true, message: "Gmail connected! Test email sent to your inbox." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Gmail test failed:", e);
        return new Response(JSON.stringify({
          success: false,
          error: e instanceof Error ? e.message : "Failed to connect to Gmail. Check your email and app password.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ===== ACTION: Disconnect email =====
    if (action === "disconnect_email") {
      await supabaseAdmin
        .from("user_email_settings")
        .upsert({
          user_id: user.id,
          provider: "gmail",
          gmail_email: null,
          gmail_app_password: null,
          is_configured: false,
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ACTION: Generate AI email draft =====
    if (action === "generate") {
      if (!lovableKey) throw new Error("AI not configured");

      const { leadName, leadEmail, leadCompany, leadNotes, leadType, purpose, tone, sequenceName } = body;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expert outreach email copywriter for creative professionals. Write compelling, personalized cold emails that feel authentic and human. Keep emails concise (under 150 words). Use the sender's profile to personalize. Never be salesy or pushy. Match the requested tone.`,
            },
            {
              role: "user",
              content: `Write an outreach email.

SENDER: ${senderProfile?.full_name || "Creative Professional"}, ${senderProfile?.role || "Creator"}
${senderProfile?.bio ? `Bio: ${senderProfile.bio.slice(0, 200)}` : ""}

RECIPIENT: ${leadName}${leadCompany ? ` at ${leadCompany}` : ""}${leadType ? ` (${leadType})` : ""}
${leadNotes ? `Context: ${leadNotes}` : ""}

PURPOSE: ${purpose || "Introduce myself and explore collaboration"}
TONE: ${tone || "professional yet friendly"}
${sequenceName ? `SEQUENCE: ${sequenceName}` : ""}

Return ONLY the email subject and body. Format:
SUBJECT: [subject line]
BODY: [email body with paragraphs]`,
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI generation failed");
      }

      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || "";

      const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
      const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

      return new Response(JSON.stringify({
        subject: subjectMatch?.[1]?.trim() || "Collaboration Opportunity",
        body: bodyMatch?.[1]?.trim() || content.trim(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== ACTION: Send a single email =====
    if (action === "send") {
      const { to, subject, body: emailBody, sequenceEmailId, leadId } = body;
      if (!to || !subject || !emailBody) throw new Error("Missing to, subject, or body");

      const result = await sendEmail(to, subject, emailBody);
      if (!result.success) throw new Error(result.error || "Email send failed");

      console.log(`Outreach email sent to ${to} via ${useGmail ? "Gmail" : "Resend"}`);

      // Update sequence_email status if linked
      if (sequenceEmailId) {
        await supabaseAdmin
          .from("sequence_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", sequenceEmailId)
          .eq("user_id", user.id);
      }

      // Update lead last_contacted_at if linked
      if (leadId) {
        await supabaseAdmin
          .from("leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", leadId)
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ success: true, emailId: result.emailId, sentVia: useGmail ? "gmail" : "resend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ACTION: Send entire sequence (next pending email) =====
    if (action === "send_sequence") {
      const { sequenceId } = body;
      if (!sequenceId) throw new Error("Missing sequenceId");

      const { data: sequence, error: seqError } = await supabaseAdmin
        .from("outreach_sequences")
        .select("*")
        .eq("id", sequenceId)
        .eq("user_id", user.id)
        .single();

      if (seqError || !sequence) throw new Error("Sequence not found");

      let recipientEmail: string | null = sequence.recipient_email || null;
      if (!recipientEmail && sequence.lead_id) {
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("email, name")
          .eq("id", sequence.lead_id)
          .single();
        recipientEmail = lead?.email || null;
      }

      if (!recipientEmail) throw new Error("No recipient email — link a lead with an email to this sequence");

      const { data: emails } = await supabaseAdmin
        .from("sequence_emails")
        .select("*")
        .eq("sequence_id", sequenceId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("step_number", { ascending: true });

      if (!emails || emails.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0, message: "No pending emails" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailToSend = emails[0];
      const result = await sendEmail(recipientEmail, emailToSend.subject, emailToSend.body);
      if (!result.success) throw new Error(result.error || "Failed to send");

      await supabaseAdmin
        .from("sequence_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", emailToSend.id);

      await supabaseAdmin
        .from("outreach_sequences")
        .update({
          completed_steps: (sequence.completed_steps || 0) + 1,
          status: "active",
        })
        .eq("id", sequenceId);

      if (sequence.lead_id) {
        await supabaseAdmin
          .from("leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", sequence.lead_id);
      }

      return new Response(JSON.stringify({
        success: true,
        sent: 1,
        remaining: emails.length - 1,
        emailId: emailToSend.id,
        sentVia: useGmail ? "gmail" : "resend",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("send-outreach-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
