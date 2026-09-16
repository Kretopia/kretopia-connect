import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation schema
const EmailRequestSchema = z.object({
  to: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .optional(),
  recipientId: z.string().uuid('Invalid recipient ID').optional(),
  type: z.enum([
    'welcome', 'opportunity', 'match', 're-engagement', 'application', 
    'weekly-digest', 'activity-digest', 'streak-warning', 'swipe', 
    'onboarding-reminder', 'general'
  ]),
  data: z.record(z.any()).optional()
}).refine(
  (data) => data.to || data.recipientId,
  { message: "Either 'to' or 'recipientId' must be provided" }
);

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Authorizes the caller against the recipient they asked for. Three paths:
//  1. Service-role JWT (other edge functions / cron, e.g. notify-swipe,
//     send-streak-warning) — always allowed.
//  2. An authenticated user sending to themselves (self-service, e.g. the
//     onboarding welcome email) — allowed.
//  3. An authenticated admin sending to someone else (e.g. AdminBroadcast) —
//     allowed after a live role check against public.user_roles.
// Anything else — including an anon-key-only caller, which is public and
// ships in the frontend bundle — is denied. Without this check this handler
// was an unauthenticated open relay: `type: 'general'` accepts arbitrary
// title/message/link content sent through the real verified sender.
async function authorizeSend(
  req: Request,
  to: string | undefined,
  recipientId: string | undefined,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const deny = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const claims = parseJwtClaims(token);
  if (!claims) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  if (claims.role === "service_role") {
    return { ok: true };
  }

  const callerId = claims.sub as string | undefined;
  const callerEmail = claims.email as string | undefined;
  if (!callerId) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  const isSelf =
    (!!recipientId && recipientId === callerId) ||
    (!!to && !!callerEmail && to.toLowerCase() === callerEmail.toLowerCase());
  if (isSelf) {
    return { ok: true };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const roleResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${callerId}&role=eq.admin&select=role`,
    { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } },
  );
  const roles = roleResponse.ok ? await roleResponse.json() : [];
  if (Array.isArray(roles) && roles.length > 0) {
    return { ok: true };
  }

  return { ok: false, response: deny(403, "Forbidden: cannot send notifications to other users") };
}

interface EmailRequest {
  to?: string;
  recipientId?: string;
  type: 'welcome' | 'opportunity' | 'match' | 're-engagement' | 'application' | 'weekly-digest' | 'activity-digest' | 'streak-warning' | 'swipe' | 'onboarding-reminder' | 'general';
  data?: {
    notificationTitle?: string;
    notificationMessage?: string;
    actionUrl?: string;
    userName?: string;
    opportunityTitle?: string;
    opportunityUrl?: string;
    matchName?: string;
    applicationStatus?: string;
    projectName?: string;
    opportunityCount?: number;
    opportunities?: Array<{
      title: string;
      type: string;
      compensation: string;
      url: string;
    }>;
    newOpportunitiesCount?: number;
    daysInactive?: number;
    totalUnread?: number;
    matches?: number;
    messages?: number;
    connections?: number;
    opportunityNotifications?: number;
    streakCount?: number;
    hasFreezes?: boolean;
    freezesAvailable?: number;
    swiperName?: string;
    swiperRole?: string;
    swiperAvatar?: string;
    stepMessage?: string;
    onboardingUrl?: string;
  };
}

const generateEmailContent = (type: string, data: any, unsubscribeToken?: string) => {
  const baseUrl = 'https://www.kretopia.com';
  const unsubscribeUrl = unsubscribeToken ? `${baseUrl}/unsubscribe?token=${unsubscribeToken}` : `${baseUrl}/notification-settings`;
  const unsubscribeFooter = `<p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 15px;">Don't want these emails? <a href="${unsubscribeUrl}" style="color: #4338CA;">Unsubscribe</a> or manage your <a href="${baseUrl}/notification-settings" style="color: #4338CA;">notification preferences</a>.</p>`;
  
  const emailWrapper = (content: string) => `
    <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 32px 28px 0;">
        <img src="https://kwmcocsitwssrtzkdojh.supabase.co/storage/v1/object/public/email-assets/logo.png" width="48" height="48" alt="Kretopia" style="margin-bottom: 24px;" />
      </div>
      ${content}
      <div style="padding: 20px 28px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Verified Credits · Real Gigs · Get Paid</p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 5px 0 0 0;">© Kretopia</p>
      </div>
      <div style="padding: 0 28px 20px;">
        ${unsubscribeFooter}
      </div>
    </div>
  `;

  switch (type) {
    case 'welcome':
      return {
        subject: "Welcome to Kretopia — Here's How to Get Started",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">Welcome, ${data.userName}</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 24px;">You're now part of the professional creative network. Here's how to make the most of Kretopia.</p>
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
                <p style="margin: 0 0 4px; color: #0a0a0f; font-weight: 600; font-size: 14px;">1. Complete Your Profile</p>
                <p style="margin: 0; color: #606068; font-size: 13px;">Add your bio, skills, and portfolio. Complete profiles get 5x more visibility.</p>
              </td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
                <p style="margin: 0 0 4px; color: #0a0a0f; font-weight: 600; font-size: 14px;">2. Claim Your Credits</p>
                <p style="margin: 0; color: #606068; font-size: 13px;">Search your name and verify the work you've done. Build your professional record.</p>
              </td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
                <p style="margin: 0 0 4px; color: #0a0a0f; font-weight: 600; font-size: 14px;">3. Browse Gigs or Post Your Own</p>
                <p style="margin: 0; color: #606068; font-size: 13px;">Find paid work, barter opportunities, or post gigs to attract talent.</p>
              </td></tr>
              <tr><td style="padding: 12px 0;">
                <p style="margin: 0 0 4px; color: #0a0a0f; font-weight: 600; font-size: 14px;">4. Match & Collaborate</p>
                <p style="margin: 0; color: #606068; font-size: 13px;">Connect with creators who complement your skills. Message, plan, and get paid.</p>
              </td></tr>
            </table>

            <div style="text-align: center; margin: 24px 0 8px;">
              <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Get Started</a>
            </div>
            <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-top: 20px;">Questions? Just reply to this email.</p>
          </div>
        `)
      };
    
    case 'opportunity':
      return {
        subject: `New Gig: ${data.opportunityTitle}`,
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">New gig posted</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName}, a gig matching your profile just went live:</p>
            <div style="background: #F5F3FF; padding: 20px; border-radius: 12px; margin: 0 0 24px; border-left: 4px solid #4338CA;">
              <p style="margin: 0; color: #0a0a0f; font-weight: 600; font-size: 16px;">${data.opportunityTitle}</p>
            </div>
            <a href="${data.opportunityUrl}" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">View Gig</a>
          </div>
        `)
      };
    
    case 'match':
      return {
        subject: "It's a Match — " + (data.matchName || "A creator") + " wants to connect",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px; text-align: center;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">It's a Match</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">You and <strong style="color: #4338CA;">${data.matchName}</strong> both want to connect. Start a conversation and see where it goes.</p>
            <div style="background: #F5F3FF; padding: 20px; margin: 0 0 24px; border-radius: 12px;">
              <p style="margin: 0; color: #3730A3; font-size: 15px;">Great collaborations start with a simple hello.</p>
            </div>
            <a href="${baseUrl}/messages" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Say Hello</a>
          </div>
        `)
      };
    
    case 're-engagement':
      return {
        subject: "Your creative network misses you",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">Been a while, ${data.userName}</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">While you were away, new creatives joined, gigs were posted, and people have been viewing your profile. Don't let opportunities slip by.</p>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">See What's New</a>
          </div>
        `)
      };
    
    case 'application':
      return {
        subject: `Update on ${data.projectName}`,
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">Application update</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName}, your application for <strong>"${data.projectName}"</strong> has moved to: <strong style="color: #4338CA;">${data.applicationStatus}</strong></p>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">View Details</a>
          </div>
        `)
      };
    
    case 'weekly-digest':
      const opportunitiesList = data.opportunities?.map((opp: any) => `
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
          <p style="margin: 0 0 4px; color: #0a0a0f; font-weight: 600; font-size: 14px;">${opp.title}</p>
          <p style="margin: 0; color: #606068; font-size: 13px;">${opp.type} · ${opp.compensation}</p>
          <a href="${opp.url}" style="color: #4338CA; font-size: 13px; text-decoration: none;">View →</a>
        </td></tr>
      `).join('') || '';
      
      return {
        subject: `Your weekly roundup`,
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">This week on Kretopia</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName}, here's what's been happening:</p>
            ${opportunitiesList ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">${opportunitiesList}</table>` : '<p style="color: #606068; font-size: 14px;">Check out new creators and gigs this week.</p>'}
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Explore</a>
          </div>
        `)
      };
    
    case 'activity-digest':
      const activityItems = [];
      if (data.matches && data.matches > 0) {
        activityItems.push(`<li style="margin-bottom: 8px;"><strong>${data.matches}</strong> new ${data.matches === 1 ? 'match' : 'matches'}</li>`);
      }
      if (data.messages && data.messages > 0) {
        activityItems.push(`<li style="margin-bottom: 8px;"><strong>${data.messages}</strong> unread ${data.messages === 1 ? 'message' : 'messages'}</li>`);
      }
      if (data.connections && data.connections > 0) {
        activityItems.push(`<li style="margin-bottom: 8px;"><strong>${data.connections}</strong> new ${data.connections === 1 ? 'connection' : 'connections'}</li>`);
      }
      if (data.opportunityNotifications && data.opportunityNotifications > 0) {
        activityItems.push(`<li style="margin-bottom: 8px;"><strong>${data.opportunityNotifications}</strong> gig ${data.opportunityNotifications === 1 ? 'update' : 'updates'}</li>`);
      }
      
      return {
        subject: `${data.totalUnread} things waiting for you`,
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">You've got activity</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName}, here's what you missed:</p>
            <ul style="line-height: 1.8; margin: 0 0 24px; color: #0a0a0f; font-size: 15px; padding-left: 20px;">
              ${activityItems.join('')}
            </ul>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Catch Up</a>
          </div>
        `)
      };
    
    case 'streak-warning':
      const freezeMessage = data.hasFreezes 
        ? `You have <strong>${data.freezesAvailable} streak ${data.freezesAvailable === 1 ? 'freeze' : 'freezes'}</strong> available to protect your streak automatically.`
        : `You don't have any streak freezes — your streak will reset if you don't visit today.`;
      
      return {
        subject: `Your ${data.streakCount}-day streak is at risk`,
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">Don't lose your streak</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName}, you've built a <strong>${data.streakCount}-day streak</strong>. ${freezeMessage}</p>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Keep It Going</a>
          </div>
        `)
      };
    
    case 'swipe':
      return {
        subject: "Someone's interested in working with you",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px; text-align: center;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">Someone's interested</h1>
            ${data.swiperAvatar ? `<img src="${data.swiperAvatar}" alt="Profile" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin-bottom: 16px;">` : ''}
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;"><strong style="color: #0a0a0f;">${data.swiperName}</strong> (${data.swiperRole}) wants to connect. Swipe right to match.</p>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">See Who</a>
          </div>
        `)
      };
    
    case 'onboarding-reminder':
      return {
        subject: "Finish your profile — it takes 2 minutes",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #0a0a0f; margin: 0 0 16px;">You're almost there</h1>
            <p style="font-size: 15px; color: #606068; line-height: 1.6; margin: 0 0 20px;">Hey ${data.userName || 'there'}, ${data.stepMessage || "you started setting up your Kretopia profile but haven't finished yet."}</p>
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">Complete profiles get <strong>5x more visibility</strong>. Creatives are searching for talent like you right now.</p>
            </div>
            <a href="${data.onboardingUrl || baseUrl + '/onboarding'}" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">Complete Profile</a>
          </div>
        `)
      };
    
    case 'general':
      return {
        subject: data.notificationTitle || "Update from Kretopia",
        html: `
          <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0B0D14; color: #E5E7EB;">
            <div style="padding: 32px 28px 8px;">
              <img src="https://kwmcocsitwssrtzkdojh.supabase.co/storage/v1/object/public/email-assets/logo.png" width="44" height="44" alt="Kretopia" style="display:block; margin-bottom: 20px;" />
              <div style="display:inline-block; padding: 4px 10px; background: rgba(217,255,0,0.12); color: #D9FF00; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 999px; margin-bottom: 16px;">What's new</div>
              <h1 style="font-size: 28px; line-height: 1.2; font-weight: 800; color: #ffffff; margin: 0 0 24px;">${data.notificationTitle || "Platform Update"}</h1>
            </div>
            <div style="padding: 0 28px 8px;">
              <div style="color: #CBD5E1; white-space: pre-wrap; font-size: 15px; line-height: 1.7;">${data.notificationMessage || "We have an important update for you."}</div>
            </div>
            ${data.actionUrl ? `
            <div style="padding: 24px 28px 8px;">
              <a href="${data.actionUrl}" style="display: inline-block; padding: 14px 28px; background: #D9FF00; color: #0B0D14; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 15px;">Open Kretopia →</a>
            </div>` : ''}
            <div style="padding: 32px 28px 16px; border-top: 1px solid #1F2937; margin-top: 32px;">
              <p style="color: #6B7280; font-size: 12px; margin: 0;">Verified Credits · Real Gigs · Get Paid</p>
              <p style="color: #6B7280; font-size: 12px; margin: 6px 0 0 0;">© Kretopia</p>
              <p style="color: #6B7280; font-size: 12px; margin-top: 14px;">Don't want these emails? <a href="${unsubscribeUrl}" style="color: #D9FF00;">Unsubscribe</a> or manage your <a href="${baseUrl}/notification-settings" style="color: #D9FF00;">preferences</a>.</p>
            </div>
          </div>
        `
      };

    default:
      return {
        subject: "Notification from Kretopia",
        html: emailWrapper(`
          <div style="padding: 0 28px 28px;">
            <p style="font-size: 15px; color: #606068;">You have a new notification.</p>
            <a href="${baseUrl}" style="display: inline-block; padding: 14px 28px; background: #4338CA; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">View</a>
          </div>
        `)
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawData = await req.json();
    const validationResult = EmailRequestSchema.safeParse(rawData);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: validationResult.error.errors
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = validationResult.data;

    // Not in supabase/config.toml, so this function runs with the platform
    // default (verify_jwt=true) — but that only proves the caller holds *a*
    // signed JWT, and the public anon key qualifies. authorizeSend() is the
    // real gate: service-role callers, self-service, or admin-only.
    const authResult = await authorizeSend(req, body.to, body.recipientId);
    if (!authResult.ok) {
      return authResult.response;
    }

    let to = body.to;
    const type = body.type;
    let data = body.data || {};
    let unsubscribeToken: string | undefined;
    
    // If recipientId is provided, fetch email and user info from database
    if (body.recipientId && !to) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?user_id=eq.${body.recipientId}&select=full_name`,
        {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          }
        }
      );
      
      const profiles = await profileResponse.json();
      const profile = profiles[0];
      
      // Fetch email from auth.users using admin endpoint
      const userResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${body.recipientId}`,
        {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          }
        }
      );
      
      const user = await userResponse.json();
      to = user.email;
      
      // Fetch unsubscribe token
      try {
        const prefsResponse = await fetch(
          `${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${body.recipientId}&select=unsubscribe_token`,
          {
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            }
          }
        );
        const prefs = await prefsResponse.json();
        if (prefs[0]?.unsubscribe_token) {
          unsubscribeToken = prefs[0].unsubscribe_token;
        }
      } catch (e) {
        console.log("Could not fetch unsubscribe token:", e);
      }
      
      // Add userName to data
      data.userName = profile?.full_name || 'there';
      
      // For match emails, add the matched user's name
      if (type === 'match' && body.data?.matchedUserName) {
        data.matchName = body.data.matchedUserName;
      }
    }
    
    if (!to || !type) {
      throw new Error("Missing required fields: to or recipientId, type");
    }

    const { subject, html } = generateEmailContent(type, data, unsubscribeToken);

    console.log(`Sending ${type} email to ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Kretopia <info@kretopia.com>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);