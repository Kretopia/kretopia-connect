// ThriveFund: Create a pledge with manual-capture (all-or-nothing model)
// - Authorizes the card now via Stripe Checkout (capture_method: manual)
// - Creates a 'pledges' row with capture_status='authorized'
// - Funds are only captured if campaign reaches goal by deadline
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { checkPledgeRequest, classifyOpenPledge } from "../_shared/pledgeRequest.ts";


import { corsFor } from '../_shared/guard.ts';
const log = (step: string, details?: any) => {
  console.log(`[THRIVEFUND-PLEDGE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const refuse = (corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.email) throw new Error("Not authenticated");

    const {
      campaignId,
      tierId,
      amount, // in dollars (e.g. 25.00) — will convert to cents
      isAnonymous = false,
      backerMessage,
    } = await req.json();

    if (!campaignId) throw new Error("campaignId required");

    log("request", { campaignId, tierId, amount, userId: user.id });

    // Load campaign + creator's stripe account
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, currency, status, deadline, creator_id, platform_fee_pct")
      .eq("id", campaignId)
      .single();
    if (campErr || !campaign) throw new Error("Campaign not found");
    if (campaign.status !== "active") throw new Error("Campaign is not active");
    if (new Date(campaign.deadline) < new Date()) throw new Error("Campaign deadline has passed");

    // The request itself: a positive amount with a ceiling, not the campaign's own creator, a
    // literal boolean and a clipped string message (_shared/pledgeRequest.ts).
    const checked = checkPledgeRequest({ amount, isAnonymous, backerMessage }, campaign, user.id);
    if (!checked.ok) return refuse(corsHeaders, checked.status, checked.error);

    const { data: creator } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id, stripe_account_status")
      .eq("user_id", campaign.creator_id)
      .single();
    if (!creator?.stripe_account_id || creator.stripe_account_status !== "active") {
      throw new Error("Creator has not finished payout setup");
    }

    // Validate tier if provided
    let tier = null;
    if (tierId) {
      const { data: t } = await supabaseAdmin
        .from("pledge_tiers")
        .select("id, amount, title, max_backers, claimed_count, is_active")
        .eq("id", tierId)
        .eq("campaign_id", campaignId)
        .single();
      if (!t || !t.is_active) throw new Error("Tier not available");
      if (t.max_backers && t.claimed_count >= t.max_backers) {
        throw new Error("Tier sold out");
      }
      if (checked.amount < Number(t.amount)) {
        throw new Error(`Pledge must be at least ${t.amount} for this tier`);
      }
      tier = t;
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const amountCents = checked.amountCents;
    const platformFeeCents = Math.round(amountCents * (Number(campaign.platform_fee_pct) / 100));
    const currency = (campaign.currency || "USD").toLowerCase();

    // One live pledge per account and campaign. A completed Checkout session is a pledge already
    // made; an open one is superseded by this request (its session expired, its row cancelled so
    // the totals stop counting it); an expired one is cancelled. An unreadable one is not "none":
    // 503 and nothing is created.
    const { data: earlier, error: earlierErr } = await supabaseAdmin
      .from("pledges")
      .select("id, stripe_checkout_session_id")
      .eq("campaign_id", campaignId)
      .eq("backer_id", user.id)
      .eq("capture_status", "authorized")
      .limit(20);
    if (earlierErr) return refuse(corsHeaders, 503, "Could not check your existing pledges, try again shortly");
    for (const old of earlier ?? []) {
      if (old.stripe_checkout_session_id) {
        let action;
        try {
          const prior = await stripe.checkout.sessions.retrieve(old.stripe_checkout_session_id);
          action = classifyOpenPledge(prior);
        } catch (_e) {
          return refuse(corsHeaders, 503, "Could not check your existing pledges, try again shortly");
        }
        if (action === "already_backed") return refuse(corsHeaders, 409, "You already have a pledge on this campaign");
        if (action === "unknown") return refuse(corsHeaders, 503, "Could not check your existing pledges, try again shortly");
        if (action === "supersede") {
          try {
            await stripe.checkout.sessions.expire(old.stripe_checkout_session_id);
          } catch (_e) {
            return refuse(corsHeaders, 503, "Could not replace your earlier pledge, try again shortly");
          }
        }
      }
      await supabaseAdmin.from("pledges").update({ capture_status: "cancelled" }).eq("id", old.id);
    }

    // Find/reuse Stripe customer
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "https://www.thrivein.io";

    // Create insert pending pledge first so we have an ID to put in metadata
    const { data: pledge, error: pledgeErr } = await supabaseAdmin
      .from("pledges")
      .insert({
        campaign_id: campaignId,
        backer_id: user.id,
        tier_id: tierId ?? null,
        amount: checked.amount,
        currency: campaign.currency || "USD",
        capture_status: "authorized",
        is_anonymous: checked.isAnonymous,
        backer_message: checked.backerMessage,
      })
      .select()
      .single();
    if (pledgeErr) throw pledgeErr;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: tier ? `${campaign.title} — ${tier.title}` : campaign.title,
              description: "ThriveFund pledge (charged only if goal is met)",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: creator.stripe_account_id },
        metadata: {
          source: "thrivefund",
          campaign_id: campaignId,
          pledge_id: pledge.id,
          tier_id: tierId ?? "",
          backer_id: user.id,
        },
      },
      success_url: `${origin}/fund/${campaign.slug}?pledge=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/fund/${campaign.slug}?pledge=cancelled`,
      metadata: {
        source: "thrivefund",
        campaign_id: campaignId,
        pledge_id: pledge.id,
      },
    });

    // Save session id on the pledge
    await supabaseAdmin
      .from("pledges")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", pledge.id);

    log("session_created", { sessionId: session.id, pledgeId: pledge.id });

    // Fire-and-forget pledge confirmation email
    try {
      const { data: backerProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const deadlineDate = new Date(campaign.deadline).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
      await supabaseAdmin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "thrivefund-pledge-confirmed",
          recipientEmail: user.email,
          idempotencyKey: `thrivefund-pledge-${pledge.id}`,
          templateData: {
            backerName: backerProfile?.full_name?.split(" ")[0] || null,
            campaignTitle: campaign.title,
            pledgeAmount: new Intl.NumberFormat("en-US", { style: "currency", currency: campaign.currency || "USD" }).format(checked.amount),
            campaignUrl: `${origin}/fund/${campaign.slug}`,
            deadlineDate,
          },
        },
      });
    } catch (e) {
      log("email_skipped", { err: String(e) });
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id, pledgeId: pledge.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
