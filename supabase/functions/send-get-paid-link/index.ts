import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ProjectAccessError, requireProjectAccess } from "../_shared/projectAccess.ts";
import {
  GET_PAID_MESSAGE_MAX,
  GET_PAID_NAME_MAX,
  decideGetPaidLink,
  type GetPaidAccess,
} from "../_shared/getPaidLink.ts";
import { cleanFreeText, escapeHtmlText, singleLine } from "../_shared/outboundText.ts";


import { corsFor } from '../_shared/guard.ts';
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-GET-PAID-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "User not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new HttpError(401, "User not authenticated");

    const body = await req.json().catch(() => ({}));
    const { projectId } = body as { projectId?: unknown };

    // The caller must hold money access on the project they name, and the
    // project title comes from the database, not from the request: this sends a
    // payment email from our own domain, so it must not be an open relay.
    let access: GetPaidAccess;
    try {
      const a = await requireProjectAccess(supabaseAdmin, projectId, user.id);
      access = { ok: true, canSeeMoney: a.canSeeMoney };
    } catch (e) {
      const status = e instanceof ProjectAccessError ? e.status : 503;
      access = { ok: false, status: status === 401 ? 401 : status === 503 ? 503 : 403 };
    }
    const decision = decideGetPaidLink({ projectId, recipientEmail: body?.recipientEmail, access });
    if (!decision.ok) throw new HttpError(decision.status, decision.error);
    const recipientEmail = decision.recipientEmail;
    const recipientName = cleanFreeText(body?.recipientName, GET_PAID_NAME_MAX);
    const message = cleanFreeText(body?.message, GET_PAID_MESSAGE_MAX);

    const { data: projectRow } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', projectId as string)
      .maybeSingle();
    const projectTitle = cleanFreeText(projectRow?.title, 120);

    logStep("Sending get-paid link", { project: projectId });

    // Get sender profile
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', user.id)
      .single();

    const senderName = cleanFreeText(senderProfile?.full_name, GET_PAID_NAME_MAX) || 'A client';
    const origin = "https://www.thrivein.io";
    
    // The "Get Paid" link takes them to ThrivePay setup page
    // If they don't have an account, they'll sign up first
    const getPaidUrl = projectId
      ? `${origin}/thrivepay?tab=payments&from=invite&project=${projectId}`
      : `${origin}/thrivepay?tab=payments&from=invite`;

    // Check if recipient already has an account
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === recipientEmail);

    let notificationSent = false;
    if (existingUser) {
      // Check if they already have Stripe Connect
      const { data: recipientProfile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id, stripe_account_status')
        .eq('user_id', existingUser.id)
        .single();

      const hasConnect = recipientProfile?.stripe_account_status === 'active';

      // Send in-app notification
      await supabaseAdmin.from('notifications').insert({
        user_id: existingUser.id,
        title: hasConnect ? '💰 Payment Incoming' : '💰 Set Up to Get Paid',
        message: hasConnect
          ? `${senderName} wants to pay you for work on "${projectTitle || 'a project'}". Payment will be sent to your connected account.`
          : `${senderName} wants to pay you! Set up your payment account to receive funds.`,
        type: 'payment',
        link: '/thrivepay?tab=payments',
        action_url: '/thrivepay?tab=payments',
        action_text: hasConnect ? 'View Payments' : 'Set Up Payments',
        priority: 'high',
        category: 'payment'
      });
      notificationSent = true;
      logStep("In-app notification sent", { userId: existingUser.id, hasConnect });
    }

    // Send email
    let emailSent = false;
    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      const personalMessage = message
        ? `<p style="background: #f3f4f6; padding: 16px; border-radius: 8px; font-style: italic; margin: 16px 0;">"${escapeHtmlText(message)}"</p>`
        : '';

      // The SDK does not throw when Resend refuses a send (for example a sender domain that is not verified): it
      // returns `error`. Without this check the answer said `emailSent: true` for an email that never left.
      const { error: sendError } = await resend.emails.send({
        from: "Kretopia <noreply@kretopia.com>",
        to: [recipientEmail],
        subject: `${singleLine(senderName, GET_PAID_NAME_MAX)} wants to pay you 💰`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 32px 0;">
              <h1 style="color: #8B5CF6; margin: 0; font-size: 28px;">Get Paid 💰</h1>
              <p style="color: #6b7280; margin-top: 8px;">Set up in under 2 minutes</p>
            </div>
            
            <p>Hi${recipientName ? ` ${escapeHtmlText(recipientName)}` : ''}!</p>
            <p><strong>${escapeHtmlText(senderName)}</strong> wants to pay you for your work${projectTitle ? ` on <strong>"${escapeHtmlText(projectTitle)}"</strong>` : ''}.</p>
            
            ${personalMessage}
            
            <p>To receive your payment, just click below to connect your payment account. It takes less than 2 minutes:</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${getPaidUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px;">
                Get Paid →
              </a>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 24px 0;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">How it works:</h3>
              <ol style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 2;">
                <li>Click the button above</li>
                <li>Create a free Kretopia account (or sign in)</li>
                <li>Connect your bank account via Stripe (secure & instant)</li>
                <li>Get paid directly to your bank! 🎉</li>
              </ol>
            </div>
            
            <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #1e40af;">
                🔒 <strong>Secure & Free:</strong> Payments are processed through Stripe, the same platform used by Amazon, Google, and Shopify. No fees for receiving payments.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              This email was sent by ${escapeHtmlText(senderName)} via Kretopia. If you weren't expecting this, you can safely ignore it.
            </p>
          </div>
        `,
      });
      if (sendError) throw new Error(sendError.message || "The email provider refused the message");
      emailSent = true;
      logStep("Email sent successfully");
    } catch (emailErr: any) {
      logStep("WARNING: Email failed", { error: emailErr.message });
    }

    return new Response(JSON.stringify({
      success: true,
      emailSent,
      notificationSent,
      recipientExists: !!existingUser,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof HttpError ? error.status : 500,
    });
  }
});
