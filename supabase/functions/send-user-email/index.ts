import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const baseUrl = 'https://www.kretopia.com';

type EmailType = 'welcome' | 'match' | 'message' | 'connection_request' | 'project_invite';

interface EmailRequest {
  type: EmailType;
  recipientId?: string;
  data?: Record<string, any>;
}

// Escapes user-controlled text before it's interpolated into an email HTML template.
const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

const generateEmailContent = (type: EmailType, data: any) => {
  const unsubscribeFooter = `<p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">Don't want these emails? <a href="${baseUrl}/notification-settings" style="color: #8B5CF6;">Manage your notification preferences</a>.</p>`;
  
  switch (type) {
    case 'welcome':
      return {
        subject: "Welcome to Kretopia – Your Step-by-Step Guide 🎉",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to Kretopia 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${escapeHtml(data.userName)}, you're officially in.</p>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Here's exactly how to get the most out of Kretopia — step by step. No guesswork needed.</p>
              
              <!-- Step 1 -->
              <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #F5F3FF; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">📸</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 1: Complete Your Profile</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">Add a photo, bio, skills, and portfolio links. Complete profiles get <strong>5x more matches</strong>. Think of it as your creative resume.</p>
                </div>
              </div>

              <!-- Step 2 -->
              <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #EFF6FF; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">👆</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 2: Start Matching in Circle</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">Swipe right on creators you'd want to work with, left to pass. When both of you swipe right — it's a match! Now you can message each other.</p>
                </div>
              </div>

              <!-- Step 3 -->
              <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #FFF7ED; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🔍</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 3: Browse or Post Gigs</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">Need a videographer? A vocalist? Browse available gigs or post your own. Set a clear budget and deadline to attract quality talent.</p>
                </div>
              </div>

              <!-- Step 4 -->
              <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #F0FDF4; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💬</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 4: Message & Collaborate</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">Chat with your matches, share files, and when you're ready — create a project together with milestones and deliverables.</p>
                </div>
              </div>

              <!-- Step 5 -->
              <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #ECFDF5; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💰</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 5: Get Paid with ThrivePay</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">For paid work, use milestone payments with escrow protection. Both sides are protected — no more getting ghosted after delivering work.</p>
                </div>
              </div>

              <!-- Step 6 -->
              <div style="display: flex; gap: 16px; margin-bottom: 28px; align-items: flex-start;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: #FFFBEB; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🏆</div>
                <div>
                  <p style="margin: 0 0 4px; color: #111; font-weight: 600; font-size: 15px;">Step 6: Build Your Credits</p>
                  <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.5;">Add project credits, get them verified by collaborators, and build a professional track record — your creative IMDB.</p>
                </div>
              </div>

              <div style="background: #F5F3FF; border-left: 4px solid #8B5CF6; padding: 16px 20px; margin: 0 0 25px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #5B21B6; font-weight: 600; font-size: 14px;">💡 Pro Tip</p>
                <p style="margin: 6px 0 0; color: #374151; font-size: 14px;">Bookmark our full guide for a deeper walkthrough of every feature — tap the button below!</p>
              </div>

              <div style="text-align: center; margin: 25px 0 10px;">
                <a href="${baseUrl}/guide" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Read the Full Guide</a>
              </div>
              <div style="text-align: center; margin: 15px 0 0;">
                <a href="${baseUrl}/circle" style="display: inline-block; padding: 12px 28px; background: #ffffff; color: #8B5CF6; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 2px solid #8B5CF6;">Start Matching Now →</a>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; text-align: center; margin-top: 30px;">Questions? Just reply to this email – we're here to help.</p>
            </div>
            <div style="padding: 20px 30px; background: #F9FAFB; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Connect, Collaborate & Create</p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 5px 0 0 0;">© Kretopia</p>
            </div>
          </div>
        `
      };
    
    case 'match':
      return {
        subject: "You've got a new match! 💫",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8B5CF6;">New Match! 💫</h1>
            <p>Hi ${escapeHtml(data.userName)},</p>
            <p>Great news! You've matched with <strong>${escapeHtml(data.matchName)}</strong>${data.matchRole ? ` (${escapeHtml(data.matchRole)})` : ''}.</p>
            <p>This is a great opportunity to start a collaboration!</p>
            <a href="${baseUrl}/circle" style="display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">View Connection</a>
            <p style="color: #666; margin-top: 30px;">Happy collaborating!<br>The Kretopia Team</p>
            ${unsubscribeFooter}
          </div>
        `
      };

    case 'message':
      return {
        subject: `💬 New message from ${data.senderName}`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Message 💬</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="color: #333; font-size: 16px;">Hi ${escapeHtml(data.recipientName)},</p>
              <p style="color: #6B7280; font-size: 16px;"><strong>${escapeHtml(data.senderName)}</strong> sent you a message:</p>
              <div style="background: #F5F3FF; padding: 20px; margin: 20px 0; border-radius: 12px; border-left: 4px solid #8B5CF6;">
                <p style="margin: 0; color: #333; font-style: italic;">"${escapeHtml(data.messagePreview)}"</p>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${baseUrl}/messages" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reply Now</a>
              </div>
            </div>
            <div style="padding: 15px 30px; background: #F9FAFB; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">© Kretopia – Connect, Collaborate & Create</p>
            </div>
            ${unsubscribeFooter}
          </div>
        `
      };

    case 'connection_request':
      return {
        subject: `🤝 ${data.senderName} wants to connect with you!`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New Connection Request 🤝</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="color: #333; font-size: 16px;">Hi ${escapeHtml(data.recipientName)},</p>
              <p style="color: #6B7280; font-size: 16px;"><strong>${escapeHtml(data.senderName)}</strong>${data.senderRole ? ` (${escapeHtml(data.senderRole)})` : ''} wants to connect with you on Kretopia!</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${baseUrl}/circle?tab=network" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Request</a>
              </div>
              <p style="color: #9CA3AF; font-size: 14px; text-align: center;">Don't miss out on potential collaborations!</p>
            </div>
            <div style="padding: 15px 30px; background: #F9FAFB; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">© Kretopia – Connect, Collaborate & Create</p>
            </div>
            ${unsubscribeFooter}
          </div>
        `
      };

    case 'project_invite':
      return {
        subject: `🚀 You've been invited to collaborate on ${data.projectTitle}`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Project Invitation 🚀</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p style="color: #333; font-size: 16px;">Hi ${escapeHtml(data.recipientName)},</p>
              <p style="color: #6B7280; font-size: 16px;"><strong>${escapeHtml(data.inviterName)}</strong> has invited you to collaborate on <strong>${escapeHtml(data.projectTitle)}</strong>!</p>
              <div style="background: #F5F3FF; padding: 20px; margin: 20px 0; border-radius: 12px; border-left: 4px solid #8B5CF6;">
                <p style="margin: 0; color: #5B21B6; font-weight: 600;">Project: ${escapeHtml(data.projectTitle)}</p>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${baseUrl}/desk/${data.projectId}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Project</a>
              </div>
              <p style="color: #9CA3AF; font-size: 14px; text-align: center;">Great things happen when creatives collaborate!</p>
            </div>
            <div style="padding: 15px 30px; background: #F9FAFB; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">© Kretopia – Connect, Collaborate & Create</p>
            </div>
            ${unsubscribeFooter}
          </div>
        `
      };
    
    default:
      return {
        subject: "Notification from Kretopia",
        html: "<p>You have a new notification.</p>"
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the calling user is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EmailRequest = await req.json();
    const { type, recipientId, data: requestData } = body;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (recipientId && !UUID_RE.test(recipientId)) {
      return new Response(
        JSON.stringify({ error: "Invalid recipientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-user-email] Processing ${type} email request from user ${user.id}`);

    // Helper: get user profile
    const getProfile = async (userId: string) => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('full_name, role')
        .eq('user_id', userId)
        .single();
      return data;
    };

    // Helper: get user email
    const getUserEmail = async (userId: string) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      return data?.user?.email;
    };

    // Helper: check notification preferences
    const shouldSendEmail = async (userId: string, category: string) => {
      const { data } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_messages, email_matches, email_opportunities')
        .eq('user_id', userId)
        .single();
      
      if (!data) return true; // Default to sending if no preferences set
      
      switch (category) {
        case 'message': return data.email_messages !== false;
        case 'match': return data.email_matches !== false;
        case 'connection': return data.email_matches !== false; // Use matches pref for connections
        case 'project': return data.email_opportunities !== false;
        default: return true;
      }
    };

    // Helper: verify the caller actually has the relationship this email type claims,
    // so an authenticated user can't spam an arbitrary recipientId with a fabricated
    // notification. Each check looks for a real row the caller's own action would have
    // created. Returns a 403 Response if the relationship doesn't exist, else null.
    const requireRelationship = async (
      relType: 'match' | 'message' | 'connection_request' | 'project_invite',
      recipient: string,
    ): Promise<{ ok: true; projectTitle?: string } | { ok: false; response: Response }> => {
      const deny = () =>
        new Response(
          JSON.stringify({ error: "No matching relationship found for this notification" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

      if (relType === 'match') {
        const { data } = await supabaseAdmin
          .from('matches')
          .select('id')
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${recipient}),and(user1_id.eq.${recipient},user2_id.eq.${user.id})`)
          .limit(1)
          .maybeSingle();
        return data ? { ok: true } : { ok: false, response: deny() };
      }

      if (relType === 'message') {
        const { data } = await supabaseAdmin
          .from('messages')
          .select('id')
          .eq('sender_id', user.id)
          .eq('receiver_id', recipient)
          .limit(1)
          .maybeSingle();
        return data ? { ok: true } : { ok: false, response: deny() };
      }

      if (relType === 'connection_request') {
        const { data } = await supabaseAdmin
          .from('connections')
          .select('id')
          .eq('user_id', user.id)
          .eq('connected_user_id', recipient)
          .limit(1)
          .maybeSingle();
        return data ? { ok: true } : { ok: false, response: deny() };
      }

      // project_invite
      const projectId = requestData?.projectId;
      if (!projectId) return { ok: false, response: deny() };
      const { data: invite } = await supabaseAdmin
        .from('project_collaborators')
        .select('project_id, projects(title)')
        .eq('project_id', projectId)
        .eq('user_id', recipient)
        .eq('invited_by', user.id)
        .limit(1)
        .maybeSingle();
      if (!invite) return { ok: false, response: deny() };
      const projectTitle = (invite as any)?.projects?.title as string | undefined;
      return { ok: true, projectTitle };
    };

    // Helper: send email
    const sendEmail = async (to: string, subject: string, html: string) => {
      const response = await resend.emails.send({
        from: "Kretopia <info@kretopia.com>",
        to: [to],
        subject,
        html,
      });
      console.log(`[send-user-email] Email sent to ${to}:`, response);
      return response;
    };

    // ---- WELCOME ----
    if (type === 'welcome') {
      const profile = await getProfile(user.id);
      const { subject, html } = generateEmailContent('welcome', {
        userName: profile?.full_name || requestData?.userName || 'there'
      });
      const emailResponse = await sendEmail(user.email!, subject, html);
      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---- MATCH ----
    if (type === 'match' && recipientId) {
      const rel = await requireRelationship('match', recipientId);
      if (!rel.ok) return rel.response;

      if (!await shouldSendEmail(recipientId, 'match')) {
        return new Response(JSON.stringify({ success: true, skipped: 'preferences' }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const recipientEmail = await getUserEmail(recipientId);
      const recipientProfile = await getProfile(recipientId);
      const senderProfile = await getProfile(user.id);

      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: "Recipient email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subject, html } = generateEmailContent('match', {
        userName: recipientProfile?.full_name || 'there',
        matchName: senderProfile?.full_name || requestData?.matchedUserName || 'someone',
        matchRole: senderProfile?.role || requestData?.matchedUserRole
      });
      const emailResponse = await sendEmail(recipientEmail, subject, html);
      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---- MESSAGE ----
    if (type === 'message' && recipientId) {
      const rel = await requireRelationship('message', recipientId);
      if (!rel.ok) return rel.response;

      if (!await shouldSendEmail(recipientId, 'message')) {
        return new Response(JSON.stringify({ success: true, skipped: 'preferences' }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const recipientEmail = await getUserEmail(recipientId);
      const recipientProfile = await getProfile(recipientId);
      const senderProfile = await getProfile(user.id);

      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: "Recipient email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truncate message preview
      const preview = (requestData?.messagePreview || '').substring(0, 100);

      const { subject, html } = generateEmailContent('message', {
        recipientName: recipientProfile?.full_name || 'there',
        senderName: senderProfile?.full_name || 'Someone',
        messagePreview: preview || 'You have a new message',
      });
      const emailResponse = await sendEmail(recipientEmail, subject, html);
      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---- CONNECTION REQUEST ----
    if (type === 'connection_request' && recipientId) {
      const rel = await requireRelationship('connection_request', recipientId);
      if (!rel.ok) return rel.response;

      if (!await shouldSendEmail(recipientId, 'connection')) {
        return new Response(JSON.stringify({ success: true, skipped: 'preferences' }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const recipientEmail = await getUserEmail(recipientId);
      const recipientProfile = await getProfile(recipientId);
      const senderProfile = await getProfile(user.id);

      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: "Recipient email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subject, html } = generateEmailContent('connection_request', {
        recipientName: recipientProfile?.full_name || 'there',
        senderName: senderProfile?.full_name || 'A creative',
        senderRole: senderProfile?.role,
      });
      const emailResponse = await sendEmail(recipientEmail, subject, html);
      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---- PROJECT INVITE ----
    if (type === 'project_invite' && recipientId) {
      const rel = await requireRelationship('project_invite', recipientId);
      if (!rel.ok) return rel.response;

      if (!await shouldSendEmail(recipientId, 'project')) {
        return new Response(JSON.stringify({ success: true, skipped: 'preferences' }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const recipientEmail = await getUserEmail(recipientId);
      const recipientProfile = await getProfile(recipientId);
      const senderProfile = await getProfile(user.id);

      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: "Recipient email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subject, html } = generateEmailContent('project_invite', {
        recipientName: recipientProfile?.full_name || 'there',
        inviterName: senderProfile?.full_name || requestData?.inviterName || 'A creative',
        projectTitle: rel.projectTitle || 'a project',
        projectId: requestData?.projectId || '',
      });
      const emailResponse = await sendEmail(recipientEmail, subject, html);
      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid request type or missing parameters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-user-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
