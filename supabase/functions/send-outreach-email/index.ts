import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { GEMINI_3_FLASH } from "../_shared/aiModels.ts";
import { cleanRecipientEmail, singleLine } from "../_shared/outboundText.ts";
import {
  OUTREACH_PER_ACTOR_PER_HOUR,
  OUTREACH_PER_RECIPIENT_PER_HOUR,
  OUTREACH_TEMPLATE,
  countActorSends,
  countRecipientSends,
  decideSendBudget,
  recordActorSend,
import { corsFor } from '../_shared/guard.ts';
} from "../_shared/outboundBudget.ts";

// A refusal with its own status (400, 409, 429, 503), mapped by the final catch.
class HttpStatusError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// A mail body is text a person wrote: bounded, so this cannot carry a payload.
const MAX_BODY_CHARS = 20000;


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
  const corsHeaders = corsFor(req);
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
    async function sendEmail(rawTo: string, rawSubject: string, rawBody: string): Promise<{ success: boolean; emailId?: string; error?: string }> {
      // One plain address and a single-line subject: the recipient and the
      // subject are caller text that ends up in mail headers.
      const to = cleanRecipientEmail(rawTo);
      if (!to) throw new HttpStatusError(400, "Invalid recipient address");
      if (rawBody.length > MAX_BODY_CHARS) throw new HttpStatusError(400, "The message is too long");
      const subject = singleLine(rawSubject, 200) || "(no subject)";

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

      // Mail that leaves from our domain shares our sending reputation: a budget
      // per account and per recipient, read before anything is sent. A count
      // that failed is not zero.
      const [actorCount, recipientCount] = await Promise.all([
        countActorSends(supabaseAdmin, user.id, OUTREACH_TEMPLATE),
        countRecipientSends(supabaseAdmin, to, OUTREACH_TEMPLATE),
      ]);
      const budget = decideSendBudget({
        actorCount,
        recipientCount,
        actorLimit: OUTREACH_PER_ACTOR_PER_HOUR,
        recipientLimit: OUTREACH_PER_RECIPIENT_PER_HOUR,
      });
      if (!budget.ok) throw new HttpStatusError(budget.status, budget.error);
      await recordActorSend(supabaseAdmin, {
        template: OUTREACH_TEMPLATE,
        actorId: user.id,
        recipientEmail: to,
        status: "sent",
      });

      return sendViaResend(
        resendApiKey,
        `${singleLine(senderProfile?.full_name, 60).replace(/[<>"\\]/g, "") || "Kretopia User"} via Kretopia <noreply@kretopia.com>`,
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
          model: GEMINI_3_FLASH,
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

      // A linked sequence email is sent once: claim it (pending or failed -> sent,
      // compare-and-set, the caller's own row) before anything leaves, so a
      // double click or a retry cannot send it twice. The claim is released if
      // the send fails.
      const releaseClaim = async () => {
        if (!sequenceEmailId) return;
        await supabaseAdmin
          .from("sequence_emails")
          .update({ status: "pending", sent_at: null })
          .eq("id", sequenceEmailId)
          .eq("user_id", user.id)
          .eq("status", "sent");
      };
      if (sequenceEmailId) {
        const { data: claimed } = await supabaseAdmin
          .from("sequence_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", sequenceEmailId)
          .eq("user_id", user.id)
          .in("status", ["pending", "failed"])
          .select("id");
        if (!claimed || claimed.length === 0) {
          throw new HttpStatusError(409, "This email was already sent or is not pending");
        }
      }

      let result: { success: boolean; emailId?: string; error?: string };
      try {
        result = await sendEmail(to, subject, emailBody);
      } catch (e) {
        await releaseClaim();
        throw e;
      }
      if (!result.success) {
        await releaseClaim();
        throw new Error(result.error || "Email send failed");
      }

      console.log(`Outreach email sent via ${useGmail ? "Gmail" : "Resend"}`);

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
          .eq("user_id", user.id)
          .maybeSingle();
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

      // Claim it (pending -> sent, compare-and-set) before it leaves: two
      // concurrent calls for the same sequence cannot send the same step twice.
      const { data: claimedStep } = await supabaseAdmin
        .from("sequence_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", emailToSend.id)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id");
      if (!claimedStep || claimedStep.length === 0) {
        throw new HttpStatusError(409, "This step was just sent; try again");
      }
      const releaseStep = async () => {
        await supabaseAdmin
          .from("sequence_emails")
          .update({ status: "pending", sent_at: null })
          .eq("id", emailToSend.id)
          .eq("user_id", user.id)
          .eq("status", "sent");
      };

      let result: { success: boolean; emailId?: string; error?: string };
      try {
        result = await sendEmail(recipientEmail, emailToSend.subject, emailToSend.body);
      } catch (e) {
        await releaseStep();
        throw e;
      }
      if (!result.success) {
        await releaseStep();
        throw new Error(result.error || "Failed to send");
      }

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
          .eq("id", sequence.lead_id)
          .eq("user_id", user.id);
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
      { status: e instanceof HttpStatusError ? e.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
