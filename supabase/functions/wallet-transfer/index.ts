import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WALLET-TRANSFER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    const { recipientId, amount, currency = "USD", description, idempotencyKey } = await req.json();

    if (!recipientId || !amount || amount <= 0) {
      throw new Error("Missing or invalid recipient/amount");
    }

    if (recipientId === user.id) {
      throw new Error("Cannot transfer to yourself");
    }

    logStep("Transfer request", { senderId: user.id, recipientId, amount, currency });

    // Idempotency: reserve the transfer row (with a unique key) BEFORE
    // moving any money, mirroring the reserve-then-act pattern already
    // proven correct in thrivefund_milestone_releases. A double-click or
    // client retry after a slow response reuses the same key — if the
    // reservation insert conflicts, this is a known retry of a transfer
    // already in flight or completed, so return that result instead of
    // debiting twice. See KREPAY_PAYMENT_AUDIT.md finding #5.
    let reservedTransferId: string | null = null;
    if (typeof idempotencyKey === "string" && idempotencyKey) {
      const { data: reserved, error: reserveError } = await supabaseAdmin
        .from("wallet_transfers")
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          amount,
          currency: currency.toUpperCase(),
          description: description || null,
          status: "pending",
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();

      if (reserveError) {
        if (reserveError.code === "23505") {
          const { data: existing } = await supabaseAdmin
            .from("wallet_transfers")
            .select("status, amount, currency")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          logStep("Duplicate transfer request, returning existing result", { idempotencyKey, status: existing?.status });
          return new Response(JSON.stringify({
            success: true,
            alreadyProcessed: true,
            amount: existing?.amount ?? amount,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }
        throw reserveError;
      }
      reservedTransferId = reserved.id;
    }

    // Check transfer limits
    const { data: limitCheck, error: limitError } = await supabaseAdmin
      .rpc("check_transfer_limit", {
        p_user_id: user.id,
        p_amount: amount,
        p_currency: currency.toUpperCase(),
      });

    if (limitError) throw limitError;
    
    const limitResult = limitCheck as any;
    if (!limitResult?.allowed) {
      throw new Error(limitResult?.reason || "Transfer limit exceeded");
    }

    // Check recipient exists
    const { data: recipient } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", recipientId)
      .single();

    if (!recipient) throw new Error("Recipient not found");

    // Atomic debit — fails if balance is insufficient (no read-then-write race)
    const { data: newSenderBalance, error: debitError } = await supabaseAdmin
      .rpc("wallet_debit", { p_user_id: user.id, p_amount: amount });

    if (debitError || newSenderBalance === null) {
      if (reservedTransferId) {
        await supabaseAdmin.from("wallet_transfers").update({ status: "failed" }).eq("id", reservedTransferId);
      }
      throw new Error("Insufficient balance");
    }

    // Atomic credit (creates the recipient wallet if missing)
    const { data: newRecipientBalance, error: creditError } = await supabaseAdmin
      .rpc("wallet_credit", { p_user_id: recipientId, p_amount: amount });

    if (creditError) {
      // Roll the debit back so funds are never lost
      await supabaseAdmin.rpc("wallet_credit", { p_user_id: user.id, p_amount: amount });
      if (reservedTransferId) {
        await supabaseAdmin.from("wallet_transfers").update({ status: "failed" }).eq("id", reservedTransferId);
      }
      throw new Error("Transfer failed");
    }

    // Record transfer: finalize the reservation made above, or insert
    // fresh if the client didn't supply an idempotency key.
    if (reservedTransferId) {
      await supabaseAdmin
        .from("wallet_transfers")
        .update({
          status: "completed",
          description: description || `Transfer to ${recipient.full_name}`,
        })
        .eq("id", reservedTransferId);
    } else {
      await supabaseAdmin
        .from("wallet_transfers")
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          amount,
          currency: currency.toUpperCase(),
          description: description || `Transfer to ${recipient.full_name}`,
          status: "completed",
        });
    }

    // Get sender name for notifications
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    // Record transactions for both users
    await supabaseAdmin.from("transactions").insert([
      {
        user_id: user.id,
        type: "sent",
        amount,
        description: description || `Sent to ${recipient.full_name}`,
      },
      {
        user_id: recipientId,
        type: "received",
        amount,
        description: description || `Received from ${senderProfile?.full_name || "Someone"}`,
      },
    ]);

    // Create notification for recipient
    await supabaseAdmin.rpc("create_notification", {
      p_user_id: recipientId,
      p_title: "Money Received! 💰",
      p_message: `${senderProfile?.full_name || "Someone"} sent you $${amount.toFixed(2)} ${currency.toUpperCase()}`,
      p_type: "payment",
      p_link: "/thrivepay",
      p_action_url: "/thrivepay",
      p_action_text: "View Wallet",
      p_priority: "high",
      p_category: "payment",
    });

    logStep("Transfer completed", {
      amount,
      newSenderBalance,
      newRecipientBalance,
    });

    return new Response(JSON.stringify({
      success: true,
      newBalance: newSenderBalance,
      recipientName: recipient.full_name,
      amount,
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
