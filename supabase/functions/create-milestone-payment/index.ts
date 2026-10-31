import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { getPlatformFeeRate } from "../_shared/platformFees.ts";
import { resolveMilestonePayee } from "../_shared/resolveMilestonePayee.ts";
import { checkMilestonePayable, checkoutTitle } from "../_shared/milestonePayable.ts";


import { corsFor } from '../_shared/guard.ts';
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MILESTONE-PAYMENT] ${step}${detailsStr}`);
};

const MANAGER_COMMISSION_RATE = 0.10; // 10%

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
    if (!authHeader) throw new Error("User not authenticated or email not available");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { milestoneId, amount: clientAmount, title: clientTitle, useEscrow, payeeUserId: requestedPayeeId } = await req.json();
    if (!milestoneId || typeof milestoneId !== "string") {
      throw new Error("Missing required fields: milestoneId");
    }

    // Get the brand's subscription tier to determine service fee
    const { data: brandProfile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single();

    const brandTier = brandProfile?.subscription_tier || 'free';
    const platformFeeRate = getPlatformFeeRate(brandTier);

    // Amount is ALWAYS sourced from the milestone's own DB row, never from
    // the client request body -- a modified/replayed request must not be
    // able to set an arbitrary charge amount for a real milestoneId. Same
    // pattern already used by batch-milestone-payout.
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from('milestones')
      .select('created_by, requested_by, status, amount, project_id, title, escrow_status, paid_at')
      .eq('id', milestoneId)
      .single();

    if (milestoneError || !milestone) {
      logStep("Rejected: milestone not found", { milestoneId, error: milestoneError?.message });
      return new Response(JSON.stringify({ error: "Milestone not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Nothing previously checked that the caller has any relationship to
    // this milestone's project before building a checkout session for it.
    // Combined with escrowAuth.ts trusting whoever's user id lands in the
    // PaymentIntent metadata, an unrelated user could pay someone else's
    // milestone with their own card and become the only party authorized to
    // ever release/cancel that escrow -- locking out the real client. Only
    // the project's client or owner may pay a milestone, same authorized-
    // payer set batch-milestone-payout already uses for the release side.
    const { data: milestoneProject } = await supabaseAdmin
      .from('projects')
      .select('client_user_id, created_by')
      .eq('id', milestone.project_id)
      .maybeSingle();
    const authorizedPayers = [milestoneProject?.client_user_id, milestoneProject?.created_by].filter(Boolean);
    if (!authorizedPayers.includes(user.id)) {
      logStep("Rejected: caller not authorized to pay this milestone", { milestoneId, userId: user.id });
      return new Response(JSON.stringify({ error: "You are not authorized to pay this milestone." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Guard against duplicate payment attempts (double-click, two tabs,
    // retried request) -- this is the authoritative check; a disabled
    // button client-side helps but isn't a security boundary. It covers a milestone that is
    // paid, captured OR already funded in escrow (a funded one is not `paid`, and a second
    // payment for it is recorded by nobody), and a row amount that cannot be charged.
    const payable = checkMilestonePayable(milestone);
    if (!payable.ok) {
      logStep("Rejected: milestone not payable", { milestoneId, reason: payable.error });
      return new Response(JSON.stringify({ error: payable.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: payable.status,
      });
    }

    // The project and the title come from the milestone's own row, not from the request body.
    const projectId: string = milestone.project_id;
    const title = checkoutTitle(milestone.title, clientTitle);
    const origin = req.headers.get("origin") || "https://www.thrivein.io";

    const talentRate = payable.amount;
    if (clientAmount !== undefined && parseFloat(clientAmount) !== talentRate) {
      logStep("Client-submitted amount ignored — mismatch with DB milestone amount", {
        milestoneId, clientAmount, dbAmount: talentRate,
      });
    }
    logStep("Payment request received", { milestoneId, talentRate, title, useEscrow });

    let hasManager = false;
    let managerTableId: string | null = null;
    let managerStripeAccountId: string | null = null;

    // Who actually gets paid -- NOT milestone.created_by, which on the main
    // "Brand creates the milestone" path is the Brand itself. See
    // _shared/resolveMilestonePayee.ts. The payee is decided HERE, before any
    // money moves, and written into the Stripe metadata so the webhook and the
    // escrow release credit the same person instead of guessing again later.
    let payee = await resolveMilestonePayee(supabaseAdmin, milestone, { payerUserId: user.id });
    if (payee.payeeUserId === null) {
      // The server found no single creative. A payer who names one of the
      // project's real candidates settles it; anything else is refused with
      // the list to pick from, rather than charging and crediting nobody
      // (or, as before, the payer).
      payee = await resolveMilestonePayee(supabaseAdmin, milestone, {
        payerUserId: user.id,
        chosenUserId: typeof requestedPayeeId === "string" ? requestedPayeeId : null,
      });
    }
    if (payee.payeeUserId === null) {
      let candidates: { user_id: string; full_name: string | null; avatar_url: string | null }[] = [];
      if (payee.candidateUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', payee.candidateUserIds);
        candidates = (profiles || []) as typeof candidates;
      }
      const none = payee.candidateCount === 0;
      logStep("Rejected: payee not identified", { milestoneId, candidateCount: payee.candidateCount, userChose: !!requestedPayeeId });
      return new Response(JSON.stringify({
        error: none
          ? "Add the creative this milestone pays to the project (they must have accepted the invitation) before paying."
          : "Choose which creative this payment is for.",
        code: none ? "PAYEE_NONE" : "PAYEE_UNCLEAR",
        candidates,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }
    const payeeUserId: string = payee.payeeUserId;

    const { data: referral } = await supabaseAdmin
      .from('talent_referrals')
      .select('manager_id, status')
      .eq('talent_user_id', payeeUserId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (referral) {
      hasManager = true;
      managerTableId = referral.manager_id;

      // Look up the manager's user ID and Stripe Connect account
      const { data: managerRecord } = await supabaseAdmin
        .from('talent_managers')
        .select('manager_user_id')
        .eq('id', referral.manager_id)
        .single();

      if (managerRecord?.manager_user_id) {
        const { data: managerProfile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_account_id, stripe_account_status')
          .eq('user_id', managerRecord.manager_user_id)
          .single();

        if (managerProfile?.stripe_account_id && managerProfile?.stripe_account_status === 'active') {
          managerStripeAccountId = managerProfile.stripe_account_id;
          logStep("Manager has active Stripe Connect", { managerStripeAccountId });
        } else {
          logStep("Manager has no active Stripe Connect — commission will be recorded but not auto-transferred");
        }
      }
    }

    // Calculate fees — all charged to brand ON TOP of talent rate
    const platformFee = Math.round(talentRate * platformFeeRate * 100) / 100;
    const managerCommission = hasManager ? Math.round(talentRate * MANAGER_COMMISSION_RATE * 100) / 100 : 0;
    const brandTotal = talentRate + platformFee + managerCommission;
    const brandTotalCents = Math.round(brandTotal * 100);

    logStep("Fee breakdown", {
      talentRate,
      brandTier,
      platformFeeRate: `${platformFeeRate * 100}%`,
      platformFee,
      hasManager,
      managerCommission,
      brandTotal,
    });

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create during checkout");
    }

    // Build line items showing transparent breakdown
    const lineItems: any[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Milestone: ${title}`,
            description: `Talent rate (paid in full to creator)`,
          },
          unit_amount: Math.round(talentRate * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Kretopia Service Fee (${(platformFeeRate * 100).toFixed(0)}%)`,
            description: `Platform service fee`,
          },
          unit_amount: Math.round(platformFee * 100),
        },
        quantity: 1,
      },
    ];

    if (hasManager && managerCommission > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Talent Manager Commission (10%)`,
            description: `Commission for talent representation`,
          },
          unit_amount: Math.round(managerCommission * 100),
        },
        quantity: 1,
      });
    }

    // Create checkout session
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/desk/${projectId}?payment=success&milestone=${milestoneId}&escrow=${useEscrow ? 'true' : 'false'}`,
      cancel_url: `${origin}/desk/${projectId}?payment=cancelled`,
      metadata: {
        kind: 'milestone',
        milestoneId,
        projectId,
        userId: user.id,
        payeeUserId,
        useEscrow: useEscrow ? 'true' : 'false',
        talentRate: String(talentRate),
        platformFee: String(platformFee),
        managerCommission: String(managerCommission),
        managerTableId: managerTableId || '',
        managerStripeAccountId: managerStripeAccountId || '',
        brandTier,
      },
    };

    // For escrow, use manual capture
    if (useEscrow) {
      sessionConfig.payment_intent_data = {
        capture_method: 'manual',
        metadata: {
          milestoneId,
          projectId,
          userId: user.id,
          payeeUserId,
          talentRate: String(talentRate),
          platformFee: String(platformFee),
          managerCommission: String(managerCommission),
          managerTableId: managerTableId || '',
          managerStripeAccountId: managerStripeAccountId || '',
        },
      };
      logStep("Using escrow mode with manual capture");
    }

    // Idempotency key from milestoneId + payer + payee + total charged (a
    // different payee is a different request, and Stripe rejects a reused key
    // with different parameters): a double-
    // click or retried request for the exact same milestone payment
    // collapses onto the same Stripe Checkout Session instead of creating a
    // second one. The "already paid" guard above means this line can never
    // be reached again for the same milestone once it succeeds, so no
    // time-window is needed here either.
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey: `milestone-payment:${milestoneId}:${user.id}:${payeeUserId}:${brandTotalCents}`,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url, escrow: useEscrow, brandTotal });

    return new Response(JSON.stringify({ 
      url: session.url, 
      sessionId: session.id,
      breakdown: {
        talentRate,
        platformFee,
        managerCommission,
        brandTotal,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in milestone payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
