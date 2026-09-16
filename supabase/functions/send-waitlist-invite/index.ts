import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = adminGuardCorsHeaders;

interface EmailRequest {
  to: string;
  fullName: string;
  inviteCode: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;


  try {
    const { to, fullName, inviteCode }: EmailRequest = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .invite-code { background: #f8f9fa; border: 2px dashed #6366f1; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 30px 0; border-radius: 8px; color: #6366f1; }
            .button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
            .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">✨ Welcome to Kretopia!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">You've been approved to join the creator economy</p>
            </div>
            <div class="content">
              <p>Hey ${fullName},</p>
              
              <p>🎉 <strong>Great news!</strong> Your application has been approved and you're now part of the Kretopia beta community.</p>
              
              <p>We reviewed your profile and believe you'll be a great addition to our creative network. Here's your exclusive invite code:</p>
              
              <div class="invite-code">${inviteCode}</div>
              
              <p><strong>What's next?</strong></p>
              <ol>
                <li>Click the button below to create your account</li>
                <li>Use your invite code during signup</li>
                <li>Complete your profile setup (takes ~2 minutes)</li>
                <li>Start discovering collaborations & opportunities</li>
              </ol>
              
              <div style="text-align: center;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/auth?inviteCode=${inviteCode}" class="button">
                  Create Your Account →
                </a>
              </div>
              
              <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                <strong>💡 Pro Tip:</strong> Complete your profile to <span class="highlight">100%</span> to unlock AI-powered match recommendations and get featured in discovery!
              </p>
              
              <div class="footer">
                <p>Welcome to the community,<br><strong>The Kretopia Team</strong></p>
                <p style="font-size: 12px; margin-top: 20px;">
                  Questions? Reply to this email or visit our <a href="${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/support" style="color: #6366f1;">Support Center</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Kretopia <info@kretopia.com>',
        to: [to],
        subject: '🎉 Welcome to Kretopia - Your Invite Code Inside',
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      throw new Error(data.message || 'Failed to send email');
    }

    console.log('Invite email sent successfully to:', to);

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-waitlist-invite:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
