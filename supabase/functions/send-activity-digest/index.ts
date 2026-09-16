import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // No auth check needed - this is a server-side cron function with verify_jwt=false

  try {
    console.log("Starting activity digest job");

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find users who haven't visited in 24+ hours
    const { data: inactiveUsers, error: queryError } = await supabase
      .from("profiles")
      .select("user_id, full_name, updated_at")
      .lt("updated_at", twentyFourHoursAgo.toISOString())
      .limit(100);

    if (queryError) {
      console.error("Error fetching users:", queryError);
      throw queryError;
    }

    console.log(`Found ${inactiveUsers?.length || 0} users inactive for 24+ hours`);

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users need activity digests", digestsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let digestsSent = 0;
    let errors: string[] = [];

    for (const user of inactiveUsers) {
      try {
        // Get unread notifications count
        const { count: unreadCount } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user_id)
          .eq("read", false);

        // Only send if 3+ unread notifications (lowered threshold)
        if (!unreadCount || unreadCount < 3) continue;

        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(user.user_id);
        if (!userData?.user?.email) continue;

        const email = userData.user.email;
        const userName = user.full_name || "Creative";

        console.log(`Sending activity digest to ${email} (${unreadCount} unread)`);

        // Get unsubscribe token
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("unsubscribe_token")
          .eq("user_id", user.user_id)
          .single();

        const unsubscribeUrl = prefs?.unsubscribe_token 
          ? `https://www.thrivein.io/unsubscribe?token=${prefs.unsubscribe_token}`
          : `https://www.thrivein.io/unsubscribe`;

        const emailResult = await resend.emails.send({
          from: "Kretopia <info@kretopia.com>",
          to: [email],
          subject: `📬 ${userName}, you have ${unreadCount} notifications waiting`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 20px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">📬 ${unreadCount} Notifications</h1>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <p style="font-size: 18px; color: #374151; margin-top: 0;">Hey ${userName},</p>
                
                <p style="color: #6b7280; line-height: 1.6;">
                  You've got <strong>${unreadCount} unread notifications</strong> waiting for you on Kretopia.
                  Someone might be trying to connect with you!
                </p>
                
                <p style="color: #6b7280; line-height: 1.6;">
                  Don't keep your potential collaborators waiting. Check out what's happening in your network.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://www.thrivein.io/circle" 
                     style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); 
                            color: white; 
                            padding: 16px 40px; 
                            text-decoration: none; 
                            border-radius: 50px; 
                            font-weight: 600;
                            font-size: 16px;
                            display: inline-block;
                            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                    Check Notifications →
                  </a>
                </div>
                
                <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 30px;">
                  Keep creating! ✨<br>
                  The Kretopia Team
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 20px;">
                <a href="${unsubscribeUrl}" style="color: #9ca3af; font-size: 12px; text-decoration: underline;">
                  Unsubscribe from these emails
                </a>
              </div>
            </body>
            </html>
          `,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
          }
        });

        if (emailResult.error) {
          console.error(`Failed to send to ${email}:`, emailResult.error);
          errors.push(`${email}: ${emailResult.error.message}`);
        } else {
          console.log(`Successfully sent activity digest to ${email}`);
          digestsSent++;
        }
      } catch (err: any) {
        console.error(`Error processing user ${user.user_id}:`, err);
        errors.push(`${user.user_id}: ${err.message}`);
      }
    }

    console.log(`Activity digest complete: ${digestsSent} sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        digestsSent,
        usersChecked: inactiveUsers.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in activity digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);