// ThriveFund: Finalize a campaign at its deadline
// - If total_raised >= goal_amount: capture all authorized pledges (release first milestone tranche)
// - If not: cancel all authorized pledges (no money charged) and mark failed
// - Idempotent: safe to call multiple times
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";

const corsHeaders = adminGuardCorsHeaders;

const log = (s: string, d?: any) =>
  console.log(`[THRIVEFUND-FINALIZE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, slug, title, status, goal_amount, total_raised, deadline, creator_id, milestone_split")
      .eq("id", campaignId)
      .single();
    if (cErr || !campaign) throw new Error("Campaign not found");

    if (!["active", "funded", "failed"].includes(campaign.status)) {
      throw new Error(`Campaign in unexpected status: ${campaign.status}`);
    }

    // The whole point of a deadline is that backers' cards aren't touched
    // before it passes -- enforce that server-side too, not just by only
    // ever being called once the deadline has passed. Idempotent re-calls
    // after the real deadline (retries, the actual scheduler) are unaffected.
    if (new Date(campaign.deadline) > new Date()) {
      throw new Error("Campaign deadline has not passed yet");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const goalMet = Number(campaign.total_raised) >= Number(campaign.goal_amount);
    log("evaluating", { goalMet, raised: campaign.total_raised, goal: campaign.goal_amount });

    // Load all authorized pledges
    const { data: pledges } = await supabaseAdmin
      .from("pledges")
      .select("id, stripe_payment_intent_id, stripe_checkout_session_id, capture_status, amount")
      .eq("campaign_id", campaignId)
      .eq("capture_status", "authorized");

    let captured = 0;
    let cancelled = 0;
    let errors = 0;

    for (const p of pledges ?? []) {
      try {
        // Resolve PI from session if not stored
        let paymentIntentId = p.stripe_payment_intent_id;
        if (!paymentIntentId && p.stripe_checkout_session_id) {
          const sess = await stripe.checkout.sessions.retrieve(p.stripe_checkout_session_id);
          paymentIntentId = (sess.payment_intent as string) ?? null;
          if (paymentIntentId) {
            await supabaseAdmin
              .from("pledges")
              .update({ stripe_payment_intent_id: paymentIntentId })
              .eq("id", p.id);
          }
        }
        if (!paymentIntentId) {
          // Backer never completed checkout — cancel
          await supabaseAdmin
            .from("pledges")
            .update({ capture_status: "cancelled" })
            .eq("id", p.id);
          cancelled++;
          continue;
        }

        if (goalMet) {
          // Calculate first-tranche amount per milestone_split
          const split = Array.isArray(campaign.milestone_split) ? campaign.milestone_split : [];
          const firstPct = Number(split[0]?.pct ?? 100);
          const fullCents = Math.round(Number(p.amount) * 100);
          const captureCents = Math.round((fullCents * firstPct) / 100);

          // For first milestone tranche we capture only firstPct of the authorized amount.
          // Remaining is captured by thrivefund-release-milestone later.
          await stripe.paymentIntents.capture(paymentIntentId, {
            amount_to_capture: captureCents,
          });
          await supabaseAdmin
            .from("pledges")
            .update({
              capture_status: "captured",
              captured_at: new Date().toISOString(),
            })
            .eq("id", p.id);
          captured++;
        } else {
          await stripe.paymentIntents.cancel(paymentIntentId);
          await supabaseAdmin
            .from("pledges")
            .update({ capture_status: "cancelled" })
            .eq("id", p.id);
          cancelled++;
        }
      } catch (err) {
        errors++;
        log("pledge_error", { pledgeId: p.id, err: String(err) });
      }
    }

    const newStatus = goalMet ? "funded" : "failed";
    await supabaseAdmin
      .from("campaigns")
      .update({ status: newStatus, ended_at: new Date().toISOString() })
      .eq("id", campaignId);

    log("done", { newStatus, captured, cancelled, errors });

    // Fire-and-forget result emails to creator + all backers
    try {
      const templateName = goalMet ? "thrivefund-campaign-funded" : "thrivefund-campaign-failed";
      const origin = "https://www.kretopia.com";
      const campaignUrl = `${origin}/fund/${(campaign as any).slug || campaignId}`;
      const exploreUrl = `${origin}/fund`;
      const totalRaised = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(campaign.total_raised));

      // Creator email (lookup via auth admin)
      const { data: creatorAuth } = await supabaseAdmin.auth.admin.getUserById(campaign.creator_id);
      const { data: creatorProfile } = await supabaseAdmin
        .from("profiles").select("full_name").eq("user_id", campaign.creator_id).maybeSingle();
      if (creatorAuth?.user?.email) {
        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName,
            recipientEmail: creatorAuth.user.email,
            idempotencyKey: `thrivefund-final-${campaignId}-creator`,
            templateData: {
              recipientName: creatorProfile?.full_name?.split(" ")[0] || null,
              campaignTitle: (campaign as any).title,
              totalRaised,
              backerCount: (pledges?.length ?? 0),
              isCreator: true,
              campaignUrl,
              exploreUrl,
            },
          },
        });
      }

      // Backer emails — pull distinct backers
      const { data: backerRows } = await supabaseAdmin
        .from("pledges")
        .select("backer_id")
        .eq("campaign_id", campaignId)
        .eq("is_anonymous", false);
      const backerIds = Array.from(new Set((backerRows ?? []).map((r: any) => r.backer_id))).filter(Boolean);
      for (const bId of backerIds) {
        try {
          const { data: bAuth } = await supabaseAdmin.auth.admin.getUserById(bId);
          if (!bAuth?.user?.email) continue;
          const { data: bProf } = await supabaseAdmin
            .from("profiles").select("full_name").eq("user_id", bId).maybeSingle();
          await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName,
              recipientEmail: bAuth.user.email,
              idempotencyKey: `thrivefund-final-${campaignId}-${bId}`,
              templateData: {
                recipientName: bProf?.full_name?.split(" ")[0] || null,
                campaignTitle: (campaign as any).title,
                totalRaised,
                backerCount: (pledges?.length ?? 0),
                isCreator: false,
                campaignUrl,
                exploreUrl,
              },
            },
          });
        } catch (e) {
          log("backer_email_err", { bId, err: String(e) });
        }
      }
    } catch (e) {
      log("email_block_err", { err: String(e) });
    }

    return new Response(
      JSON.stringify({ status: newStatus, captured, cancelled, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
