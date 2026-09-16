// ThriveFund: Release a milestone tranche to the creator
// Captures the next milestone slice from each pledge's authorized amount.
// Note: With Stripe manual-capture, we can only capture <= authorized amount once.
// To support tranche payouts, we use Stripe transfers from the platform balance after
// initial capture. This function performs a 'transfer' from the platform to the creator
// for the tranche amount (already captured at finalize time).
//
// DEPLOYMENT ORDER: this function depends on public.thrivefund_milestone_releases
// (migration 20260818120000_thrivefund_milestone_release_idempotency.sql). Do NOT
// deploy this version before that migration has been reviewed and applied — every
// release attempt would fail closed (the reserve-row insert below would error on a
// missing table), not silently skip the guard, but the feature would be unusable
// until the migration lands.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[THRIVEFUND-MILESTONE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
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
    if (!user) throw new Error("Not authenticated");

    const { campaignId, milestoneIndex } = await req.json();
    if (!campaignId) throw new Error("campaignId required");
    if (typeof milestoneIndex !== "number" || milestoneIndex < 1) {
      throw new Error("milestoneIndex must be >= 1");
    }

    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id, status, creator_id, milestone_split, currency, total_raised")
      .eq("id", campaignId)
      .single();
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.creator_id !== user.id) throw new Error("Only creator can release milestones");
    if (!["funded", "completed"].includes(campaign.status)) {
      throw new Error("Campaign must be funded to release milestones");
    }

    const split = Array.isArray(campaign.milestone_split) ? campaign.milestone_split : [];
    if (milestoneIndex >= split.length) throw new Error("milestoneIndex out of range");

    const pct = Number(split[milestoneIndex]?.pct ?? 0);
    if (pct <= 0) throw new Error("Milestone percentage invalid");

    const { data: creator } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id")
      .eq("user_id", campaign.creator_id)
      .single();
    if (!creator?.stripe_account_id) throw new Error("Creator has no payout account");

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Tranche amount = pct of total_raised
    const trancheCents = Math.round(Number(campaign.total_raised) * 100 * (pct / 100));
    const currencyUpper = campaign.currency || "USD";
    const currency = currencyUpper.toLowerCase();

    // Permanent, unlimited-window duplicate-release guard: reserve this
    // (campaign, milestone) pair BEFORE calling Stripe. The table's
    // composite primary key means a second concurrent or later-retried
    // request for the same tranche fails right here — before any money
    // moves — rather than relying solely on Stripe's 24h idempotency-key
    // cache (kept below as defense-in-depth). Any insert failure (including
    // "table does not exist" if this ever runs before the migration lands)
    // fails closed: the function aborts and no transfer is attempted.
    const { error: reserveError } = await supabaseAdmin
      .from("thrivefund_milestone_releases")
      .insert({
        campaign_id: campaignId,
        milestone_index: milestoneIndex,
        status: "pending",
        amount_cents: trancheCents,
        currency: currencyUpper,
        released_by: user.id,
      });
    if (reserveError) {
      if (reserveError.code === "23505") {
        // Unique-violation on the (campaign_id, milestone_index) primary
        // key -- this tranche was already released or is currently being
        // released by another request.
        log("rejected_duplicate", { campaignId, milestoneIndex });
        return new Response(
          JSON.stringify({ error: "This milestone tranche has already been released." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      throw new Error(`Failed to reserve milestone release: ${reserveError.message}`);
    }

    let transfer;
    try {
      // Deterministic per (campaign, milestone) key: belt-and-suspenders
      // alongside the DB reservation above -- if two requests somehow both
      // pass the reserve step (they can't, the primary key prevents it),
      // Stripe's own idempotency cache would still return the same transfer
      // instead of creating a second one.
      transfer = await stripe.transfers.create(
        {
          amount: trancheCents,
          currency,
          destination: creator.stripe_account_id,
          metadata: {
            source: "thrivefund_milestone",
            campaign_id: campaignId,
            milestone_index: String(milestoneIndex),
            pct: String(pct),
          },
        },
        { idempotencyKey: `thrivefund_milestone_${campaignId}_${milestoneIndex}` }
      );
    } catch (stripeError) {
      // Free the reservation so a legitimate retry (e.g. after a transient
      // Stripe error) isn't permanently blocked by this failed attempt.
      await supabaseAdmin
        .from("thrivefund_milestone_releases")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("milestone_index", milestoneIndex)
        .eq("status", "pending");
      throw stripeError;
    }

    await supabaseAdmin
      .from("thrivefund_milestone_releases")
      .update({
        status: "completed",
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId)
      .eq("milestone_index", milestoneIndex);

    log("transfer_created", { transferId: transfer.id, trancheCents });

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        amountReleased: trancheCents / 100,
      }),
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
