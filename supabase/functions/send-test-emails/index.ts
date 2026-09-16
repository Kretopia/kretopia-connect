import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin-only: prevent unauthenticated email spam
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test emails to: ${email}`);
    
    const emailTypes = [
      { type: 'welcome', data: { userName: 'Test User' } },
      { type: 'opportunity', data: { userName: 'Test User', opportunityTitle: 'Music Video Director Needed', opportunityUrl: 'https://thrivein.io/discover' } },
      { type: 'match', data: { userName: 'Test User', matchName: 'Creative Partner' } },
      { type: 'application', data: { userName: 'Test User', projectName: 'Brand Campaign', applicationStatus: 'Interview' } },
      { type: 're-engagement', data: { userName: 'Test User', daysInactive: 7 } },
      { type: 'weekly-digest', data: { userName: 'Test User', opportunities: [{ title: 'Video Editor', type: 'Paid', compensation: '$500', url: 'https://thrivein.io' }] } },
      { type: 'activity-digest', data: { userName: 'Test User', totalUnread: 5, matches: 2, messages: 3, connections: 1 } },
      { type: 'streak-warning', data: { userName: 'Test User', streakCount: 7, hasFreezes: true, freezesAvailable: 2 } },
    ];

    const results = [];
    
    for (const emailConfig of emailTypes) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: email,
            type: emailConfig.type,
            data: emailConfig.data,
          }),
        });
        
        const result = await response.json();
        results.push({ type: emailConfig.type, success: response.ok, result });
        console.log(`${emailConfig.type} email: ${response.ok ? 'sent' : 'failed'}`);
      } catch (error: any) {
        results.push({ type: emailConfig.type, success: false, error: error.message });
        console.error(`${emailConfig.type} email failed:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${emailTypes.length} test emails to ${email}`,
        emailTypes: emailTypes.map(e => e.type),
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
