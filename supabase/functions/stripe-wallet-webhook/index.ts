import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey, assertEventMatchesMode } from "../_shared/stripeEnv.ts";
import { claimWebhookEvent, releaseWebhookEvent } from "../_shared/webhookLedger.ts";


import { corsFor } from '../_shared/guard.ts';
const log = (s: string, d?: unknown) => console.log(`[stripe-wallet-webhook] ${s}`, d ?? "");

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = Deno.env.get("STRIPE_WALLET_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!secret) {
    log("missing STRIPE_WALLET_WEBHOOK_SECRET");
    return new Response("misconfigured", { status: 500 });
  }
  if (!sig) {
    return new Response("missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
    // Cross-mode guard: a live event must never be processed by a test
    // deployment and vice versa, even if a signing secret is misfiled.
    assertEventMatchesMode(event.livemode);
  } catch (err) {
    log("signature/mode check failed", err instanceof Error ? err.message : err);
    return new Response("bad sig", { status: 400 });
  }

  // idempotency: this delivery owns the event until it succeeds; a failure gives the row back so
  // Stripe's retry is processed instead of being answered "ok" as already seen.
  const ledgerClaim = await claimWebhookEvent(admin, event);
  if (ledgerClaim === "duplicate") {
    return new Response("ok", { status: 200 });
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        const { error: acctErr } = await admin.from("creator_wallets").update({
          payouts_enabled: acct.payouts_enabled ?? false,
          charges_enabled: acct.charges_enabled ?? false,
          kyc_status: acct.payouts_enabled
            ? "verified"
            : (acct.requirements?.disabled_reason ? "restricted" : "pending"),
          requirements: acct.requirements ?? {},
        }).eq("stripe_account_id", acct.id);
        // A status that could not be written is a failure to retry, not a success: a stale
        // payouts_enabled lets a cash-out be attempted (or blocks one) on out-of-date information.
        if (acctErr) throw new Error(`creator_wallets update failed: ${acctErr.message}`);
        break;
      }
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled":
      case "payout.created":
      case "payout.updated": {
        const p = event.data.object as Stripe.Payout;
        const { error: payoutErr } = await admin.from("creator_payouts").update({
          status: p.status,
          arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
          failure_reason: p.failure_message ?? null,
        }).eq("stripe_payout_id", p.id);
        if (payoutErr) throw new Error(`creator_payouts update failed: ${payoutErr.message}`);
        break;
      }
      case "balance.available": {
        // best-effort refresh — full refresh happens on next wallet-balance call
        break;
      }
    }
  } catch (err) {
    log("handler error", err instanceof Error ? err.message : err);
    // Not "ok": a 2xx here made a failed update permanent. Release the ledger row and answer 500 so
    // that Stripe retries the event.
    if (ledgerClaim === "claimed") await releaseWebhookEvent(admin, event.id);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
