import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey, assertEventMatchesMode } from "../_shared/stripeEnv.ts";
import { creditGuestWallet, guestTopupMismatch } from "../_shared/guestWalletCredit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(resolveStripeSecretKey(), {
    apiVersion: "2025-08-27.basil",
  });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (!webhookSecret || !signature) {
      throw new Error("Missing webhook signature or secret");
    }
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    assertEventMatchesMode(event.livemode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[guest-wallet-webhook] signature error:", msg);
    return new Response(JSON.stringify({ error: `Webhook signature error: ${msg}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only process our own checkout sessions
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const topupId = session.metadata?.topup_id;
  const kind = session.metadata?.kind;

  if (kind !== "guest_wallet_topup" || !topupId) {
    return new Response(JSON.stringify({ received: true, ignored: "not_guest_wallet" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (session.payment_status !== "paid") {
    return new Response(JSON.stringify({ received: true, ignored: `payment_status=${session.payment_status}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let ledgerRowHeld = false;
  let claimedTopupId: string | null = null;

  try {
    // Webhook-event idempotency (matches stripe-wallet-webhook pattern).
    // If we've seen this event.id before, return 200 immediately.
    const { error: dupErr } = await admin.from("stripe_webhook_events").insert({
      event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
    if (dupErr && (dupErr as { code?: string }).code === "23505") {
      return new Response(JSON.stringify({ received: true, idempotent_event: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // This request now owns the event: if it fails before the credit, the row is given back below
    // so Stripe's retry is processed instead of being answered "already seen".
    ledgerRowHeld = !dupErr;



    const { data: topup, error: topupError } = await admin
      .from("guest_wallet_topups")
      .select("id, wallet_id, amount_cents, status")
      .eq("id", topupId)
      .maybeSingle();

    if (topupError) throw topupError;
    if (!topup) {
      console.warn("[guest-wallet-webhook] topup not found:", topupId);
      return new Response(JSON.stringify({ received: true, warning: "topup_not_found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already credited
    if (topup.status === "succeeded") {
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The paid session must be the one this row was created for (amount, currency, wallet). Only
    // our own code creates sessions with this metadata; this is the second lock on the credit.
    const mismatch = guestTopupMismatch(topup, session);
    if (mismatch) {
      console.error("[guest-wallet-webhook] REFUSED: session does not match the top-up", { topupId, sessionId: session.id, mismatch });
      return new Response(JSON.stringify({ received: true, ignored: "session_mismatch" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Claim the top-up (one winner), reading the result: a claim that matched no row means another
    // delivery already took it.
    const { data: claimed, error: updateErr } = await admin
      .from("guest_wallet_topups")
      .update({ status: "succeeded" })
      .eq("id", topup.id)
      .eq("status", "pending")
      .select("id");
    if (updateErr) throw updateErr;
    if (!claimed?.length) {
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    claimedTopupId = topup.id;

    // Credit by compare-and-set on the balance: a concurrent credit is not overwritten.
    const credit = await creditGuestWallet(admin, topup.wallet_id, topup.amount_cents);
    if (!credit.ok) throw new Error("Could not credit the guest wallet");
    ledgerRowHeld = false; // the event is done: its ledger row stays
    claimedTopupId = null;

    // Audit log (the credit is made; a failed log line must not undo or repeat it)
    const { error: auditErr } = await admin.from("guest_wallet_transactions").insert({
      wallet_id: topup.wallet_id,
      delta_cents: topup.amount_cents,
      kind: "topup",
      ref_id: topup.id,
      note: `Stripe checkout ${session.id}`,
    });
    if (auditErr) console.error("[guest-wallet-webhook] audit log failed", auditErr.message);

    console.log("[guest-wallet-webhook] credited", { topupId, walletId: topup.wallet_id, amount: topup.amount_cents });

    return new Response(JSON.stringify({ received: true, credited: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[guest-wallet-webhook] processing error:", msg);
    // Nothing was credited: give back the claim and the event's ledger row so the retry Stripe
    // sends is processed (before, it was answered "already seen" and the guest was never credited).
    if (claimedTopupId) {
      const { error: revertErr } = await admin
        .from("guest_wallet_topups")
        .update({ status: "pending" })
        .eq("id", claimedTopupId)
        .eq("status", "succeeded");
      if (revertErr) {
        console.error("[guest-wallet-webhook] GUEST TOP-UP CLAIMED BUT NOT CREDITED", { topupId: claimedTopupId, message: revertErr.message });
      }
    }
    if (ledgerRowHeld) {
      const { error: releaseErr } = await admin.from("stripe_webhook_events").delete().eq("event_id", event.id);
      if (releaseErr) console.error("[guest-wallet-webhook] could not release the event ledger row", releaseErr.message);
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
