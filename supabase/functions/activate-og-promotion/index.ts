import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[OG-PROMOTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("badge, subscription_tier, og_promotion_used, og_promotion_expires_at")
      .eq("user_id", user.id)
      .single();

    if (profileError) throw profileError;

    logStep("Profile retrieved", { 
      badge: profile.badge, 
      tier: profile.subscription_tier,
      promotionUsed: profile.og_promotion_used 
    });

    // Check if user is OG or Founder and hasn't used promotion
    if (profile.badge !== 'og' && profile.badge !== 'founder') {
      return new Response(JSON.stringify({ 
        success: false,
        message: "User is not an OG or Founder member"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (profile.og_promotion_used) {
      // Check if promotion has expired
      const now = new Date();
      const expiresAt = profile.og_promotion_expires_at ? new Date(profile.og_promotion_expires_at) : null;
      
      if (expiresAt && now > expiresAt) {
        // Promotion expired, revert to free tier
        await supabaseClient
          .from("profiles")
          .update({ subscription_tier: 'free' })
          .eq("user_id", user.id);

        logStep("Promotion expired, reverted to free tier");

        return new Response(JSON.stringify({ 
          success: true,
          message: "OG promotion expired",
          action: "reverted_to_free"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ 
        success: false,
        message: "Promotion already activated",
        expiresAt: profile.og_promotion_expires_at
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Activate promotion
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 2); // 2 months from now

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        subscription_tier: 'thriver',
        og_promotion_used: true,
        og_promotion_expires_at: expiresAt.toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    logStep("Promotion activated", { expiresAt: expiresAt.toISOString() });

    return new Response(JSON.stringify({ 
      success: true,
      message: "OG promotion activated! You now have Thriver membership for 2 months.",
      expiresAt: expiresAt.toISOString(),
      tier: 'thriver'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
