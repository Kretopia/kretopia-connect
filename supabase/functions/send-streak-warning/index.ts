import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.log("Starting streak warning job");

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find users who:
    // - Haven't visited today
    // - Last visited yesterday (so streak is about to break)
    // - Have a streak of 3+ days (worth protecting)
    // - Have streak freezes available OR don't
    const { data: usersAtRisk, error: queryError } = await supabase
      .from("profiles")
      .select("user_id, full_name, streak_count, streak_freeze_count, last_active_date")
      .eq("last_active_date", yesterdayStr)
      .gte("streak_count", 3);

    if (queryError) {
      console.error("Error fetching users at risk:", queryError);
      throw queryError;
    }

    if (!usersAtRisk || usersAtRisk.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users at risk of losing streaks" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let warningsSent = 0;

    for (const user of usersAtRisk) {
      // Check notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_opportunities")
        .eq("user_id", user.user_id)
        .single();

      if (!prefs?.email_opportunities) continue;

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(user.user_id);
      if (!userData?.user?.email) continue;

      // Send warning email
      const { error: emailError } = await supabase.functions.invoke("send-notification-email", {
        body: {
          to: userData.user.email,
          type: "streak-warning",
          data: {
            userName: user.full_name,
            streakCount: user.streak_count,
            hasFreezes: user.streak_freeze_count > 0,
            freezesAvailable: user.streak_freeze_count
          }
        }
      });

      if (emailError) {
        console.error(`Failed to send warning to ${userData.user.email}:`, emailError);
      } else {
        warningsSent++;
      }
    }

    console.log(`Streak warnings sent to ${warningsSent} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        warningsSent,
        usersAtRisk: usersAtRisk.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in streak warning function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
