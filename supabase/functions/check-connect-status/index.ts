import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_account_id) {
      return new Response(JSON.stringify({
        status: "not_connected",
        requirements: [],
        message: "No Stripe account connected yet.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // Gather requirements info
    const requirements = account.requirements;
    const currentlyDue = requirements?.currently_due || [];
    const eventuallyDue = requirements?.eventually_due || [];
    const pastDue = requirements?.past_due || [];
    const disabledReason = requirements?.disabled_reason || null;

    // Determine real status
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    let resolvedStatus = "pending";
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
      resolvedStatus = "active";
    } else if (pastDue.length > 0) {
      resolvedStatus = "restricted";
    } else if (disabledReason) {
      resolvedStatus = "restricted";
    }

    // Update profile if status changed
    if (resolvedStatus !== profile.stripe_account_status) {
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_status: resolvedStatus })
        .eq("user_id", user.id);
    }

    // Format requirements into human-readable items
    const formatRequirement = (req: string): string => {
      const map: Record<string, string> = {
        "individual.first_name": "First name",
        "individual.last_name": "Last name",
        "individual.dob.day": "Date of birth",
        "individual.dob.month": "Date of birth",
        "individual.dob.year": "Date of birth",
        "individual.address.line1": "Home address",
        "individual.address.city": "City",
        "individual.address.state": "State/Province",
        "individual.address.postal_code": "Postal code",
        "individual.address.country": "Country",
        "individual.email": "Email address",
        "individual.phone": "Phone number",
        "individual.id_number": "Government ID number (SSN/SIN)",
        "individual.ssn_last_4": "Last 4 digits of SSN",
        "individual.verification.document": "Identity document (photo ID)",
        "individual.verification.additional_document": "Additional identity document",
        "business_profile.url": "Business website URL",
        "business_profile.mcc": "Business category",
        "business_profile.product_description": "Description of products/services",
        "external_account": "Bank account for payouts",
        "tos_acceptance.date": "Terms of Service acceptance",
        "tos_acceptance.ip": "Terms of Service acceptance",
        "representative.first_name": "Representative first name",
        "representative.last_name": "Representative last name",
      };
      return map[req] || req.replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    };

    // Deduplicate formatted requirements
    const allDue = [...new Set([...pastDue, ...currentlyDue])];
    const formattedRequirements = [...new Set(allDue.map(formatRequirement))];

    return new Response(JSON.stringify({
      status: resolvedStatus,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      disabledReason,
      requirements: formattedRequirements,
      pastDue: pastDue.length,
      currentlyDue: currentlyDue.length,
      eventuallyDue: eventuallyDue.length,
      deadline: requirements?.current_deadline
        ? new Date(requirements.current_deadline * 1000).toISOString()
        : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
