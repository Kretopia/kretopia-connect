import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (s: string, d?: unknown) => console.log(`[wallet-add-bank] ${s}`, d ?? "");

// Same supported-country/currency/routing shape the frontend offers — kept
// here too so a crafted request can't bypass the Select and reach Stripe
// with an unsupported combination.
const SUPPORTED_COUNTRIES: Record<string, { currency: string; routingRequired: boolean; ibanLength?: number }> = {
  US: { currency: "USD", routingRequired: true },
  CA: { currency: "CAD", routingRequired: true },
  GB: { currency: "GBP", routingRequired: true },
  AU: { currency: "AUD", routingRequired: true },
  DE: { currency: "EUR", routingRequired: false, ibanLength: 22 },
  FR: { currency: "EUR", routingRequired: false, ibanLength: 27 },
  NL: { currency: "EUR", routingRequired: false, ibanLength: 18 },
  ES: { currency: "EUR", routingRequired: false, ibanLength: 24 },
};

type ErrorCode =
  | "authentication_required"
  | "wallet_not_found"
  | "connect_account_missing"
  | "connect_account_mismatch"
  | "country_not_supported"
  | "currency_not_supported"
  | "invalid_iban"
  | "invalid_bank_details"
  | "account_requirement_missing"
  | "account_not_ready"
  | "bank_account_already_exists"
  | "stripe_configuration_error"
  | "stripe_api_error"
  | "database_persistence_error"
  | "unknown_error";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// IBAN mod-97 checksum (ISO 7064): move the first 4 chars to the end,
// convert letters to numbers (A=10..Z=35), and the resulting decimal
// string mod 97 must equal 1. This only confirms the IBAN is
// well-formed — it is not proof the account is real or payout-ready.
function isValidIbanChecksum(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(`${remainder}${numeric.slice(i, i + 7)}`) % 97;
  }
  return remainder === 1;
}

function validateIban(country: string, rawIban: string): { ok: true; iban: string } | { ok: false; message: string } {
  const iban = rawIban.replace(/\s+/g, "").toUpperCase();
  const expectedLength = SUPPORTED_COUNTRIES[country]?.ibanLength;
  if (!/^[A-Z]{2}[0-9A-Z]+$/.test(iban)) {
    return { ok: false, message: "That doesn't look like a valid IBAN." };
  }
  if (!iban.startsWith(country)) {
    return { ok: false, message: `IBAN must start with ${country} to match the selected country.` };
  }
  if (expectedLength && iban.length !== expectedLength) {
    return { ok: false, message: `A ${country} IBAN should be ${expectedLength} characters long.` };
  }
  if (!isValidIbanChecksum(iban)) {
    return { ok: false, message: "That IBAN's checksum doesn't look right — please double-check it." };
  }
  return { ok: true, iban };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: auth } = await anon.auth.getUser(token);
    const user = auth?.user;
    if (!user?.email) return errorResponse("authentication_required", "Sign in to add a bank account.", 401);

    const body = await req.json();
    const {
      country,
      currency,
      account_holder_name,
      account_number,
      routing_number, // US ABA / CA transit / etc.
      make_default = true,
      idempotencyKey,
    } = body ?? {};

    if (!country || !currency || !account_holder_name || !account_number) {
      return errorResponse("invalid_bank_details", "Fill in all required fields.", 400);
    }

    const countryCfg = SUPPORTED_COUNTRIES[country];
    if (!countryCfg) {
      return errorResponse("country_not_supported", `${country} isn't a supported payout country yet.`, 400);
    }
    if (countryCfg.currency !== String(currency).toUpperCase()) {
      return errorResponse(
        "currency_not_supported",
        `${country} accounts are paid in ${countryCfg.currency}, not ${currency}.`,
        400,
      );
    }
    if (countryCfg.routingRequired && !routing_number) {
      return errorResponse("invalid_bank_details", "Routing details are required for this country.", 400);
    }

    let normalizedAccountNumber = String(account_number).replace(/\s+/g, "");
    if (!countryCfg.routingRequired) {
      // IBAN countries — normalize and validate server-side, the only
      // place this is authoritative (the frontend's own stripping is UX
      // only and can't be trusted).
      const iban = validateIban(country, normalizedAccountNumber);
      if (!iban.ok) return errorResponse("invalid_iban", iban.message, 400);
      normalizedAccountNumber = iban.iban;
    }

    const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
    const baseIdempotencyKey =
      typeof idempotencyKey === "string" && idempotencyKey ? idempotencyKey : crypto.randomUUID();

    // Load or create wallet + Connect account
    const { data: wallet, error: walletErr } = await admin
      .from("creator_wallets")
      .select("user_id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (walletErr) {
      log("wallet lookup failed", walletErr.message);
      return errorResponse("database_persistence_error", "Couldn't load your wallet. Try again.", 500);
    }

    let accountId = wallet?.stripe_account_id ?? null;

    if (accountId) {
      // A Connect account already exists for this user — it may predate
      // country-aware account creation. Attaching a bank account whose
      // country doesn't match the connected account's own country is
      // always rejected by Stripe; catch that here with a clear,
      // actionable error instead of letting it surface as a raw 500.
      let existingAccount: Stripe.Account;
      try {
        existingAccount = await stripe.accounts.retrieve(accountId);
      } catch (err) {
        log("existing account retrieve failed", err instanceof Error ? err.message : String(err));
        return errorResponse("connect_account_missing", "Your payout account couldn't be found. Contact support.", 404);
      }
      if (existingAccount.country && existingAccount.country !== country) {
        return errorResponse(
          "connect_account_mismatch",
          `Your payout account is already set up for ${existingAccount.country}. To add a ${country} bank account, contact support to reset your payout account first.`,
          409,
        );
      }
    } else {
      log("creating Connect account", { country });
      let account: Stripe.Account;
      try {
        account = await stripe.accounts.create(
          {
            // stripe_dashboard.type "none" + requirement_collection "stripe"
            // (a headless "recipient" account, no hosted onboarding) is
            // only a valid combination when Stripe itself is liable for
            // negative balances/refunds/chargebacks -- losses.payments
            // "application" here made every account.create() call reject
            // with "Stripe must be liable for negative balances...",
            // confirmed live against the deployed function. This account
            // never processes charges (transfers-only, payout capability),
            // so Stripe bearing that risk is the correct, intended model.
            controller: {
              losses: { payments: "stripe" },
              fees: { payer: "application" },
              stripe_dashboard: { type: "none" },
              requirement_collection: "stripe",
            },
            country,
            email: user.email,
            capabilities: {
              transfers: { requested: true },
            },
            metadata: { thrivein_user_id: user.id },
          },
          { idempotencyKey: `${baseIdempotencyKey}:create-account` },
        );
      } catch (err) {
        return mapStripeError(err);
      }
      accountId = account.id;
      const { error: upsertErr } = await admin.from("creator_wallets").upsert(
        {
          user_id: user.id,
          stripe_account_id: accountId,
          country,
          default_currency: currency.toUpperCase(),
          kyc_status: "pending",
        },
        { onConflict: "user_id" },
      );
      if (upsertErr) {
        log("wallet upsert failed", upsertErr.message);
        return errorResponse("database_persistence_error", "Couldn't save your payout account. Try again.", 500);
      }
    }

    // account_holder_type must match Stripe's own classification for the
    // account, or Stripe rejects the external account attach — brand/
    // company profiles are not individuals.
    const { data: profile } = await admin
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle();
    const accountHolderType: Stripe.BankAccountCreateParams.AccountHolderType =
      profile?.account_type === "company" ? "company" : "individual";

    log("attaching bank", { accountId, accountHolderType });
    let ext: Stripe.ExternalAccount;
    try {
      ext = await stripe.accounts.createExternalAccount(
        accountId!,
        {
          external_account: {
            object: "bank_account",
            country,
            currency: currency.toLowerCase(),
            account_holder_name,
            account_holder_type: accountHolderType,
            account_number: normalizedAccountNumber,
            ...(routing_number ? { routing_number: String(routing_number).replace(/[-\s]+/g, "") } : {}),
          } as Stripe.BankAccountCreateParams,
          default_for_currency: make_default,
        },
        { idempotencyKey: `${baseIdempotencyKey}:attach-bank` },
      );
    } catch (err) {
      return mapStripeError(err);
    }

    // Mark previous defaults false in our mirror
    if (make_default) {
      await admin.from("creator_payout_methods").update({ is_default: false }).eq("user_id", user.id);
    }

    const ba = ext as Stripe.BankAccount;
    const { data: method, error: insErr } = await admin
      .from("creator_payout_methods")
      .insert({
        user_id: user.id,
        stripe_external_account_id: ba.id,
        type: "bank_account",
        last4: ba.last4,
        brand: ba.bank_name ?? null,
        currency: ba.currency?.toUpperCase() ?? currency.toUpperCase(),
        country: ba.country ?? country,
        is_default: make_default,
      })
      .select()
      .single();
    if (insErr) {
      log("payout method insert failed", insErr.message);
      return errorResponse("database_persistence_error", "Bank account was added but couldn't be saved. Contact support.", 500);
    }

    // Refresh account status
    const acct = await stripe.accounts.retrieve(accountId!);
    await admin
      .from("creator_wallets")
      .update({
        payouts_enabled: acct.payouts_enabled ?? false,
        charges_enabled: acct.charges_enabled ?? false,
        kyc_status: acct.payouts_enabled ? "verified" : "pending",
        requirements: acct.requirements ?? {},
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        ok: true,
        method,
        payouts_enabled: acct.payouts_enabled ?? false,
        requirements_due: acct.requirements?.currently_due ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", msg);
    return errorResponse("unknown_error", "Something went wrong adding your bank account. Try again.", 500);
  }
});

function mapStripeError(err: unknown): Response {
  const msg = err instanceof Error ? err.message : String(err);
  log("STRIPE_ERROR", msg);

  if (err && typeof err === "object" && "type" in err) {
    const stripeErr = err as Stripe.errors.StripeError;
    if (stripeErr.type === "StripeAuthenticationError" || stripeErr.type === "StripePermissionError") {
      return errorResponse("stripe_configuration_error", "Payments aren't configured correctly. Contact support.", 500);
    }
    if (stripeErr.type === "StripeInvalidRequestError") {
      const param = stripeErr.param ?? "";
      const code = stripeErr.code ?? "";
      if (code === "bank_account_exists" || /already.*(added|exists)/i.test(msg)) {
        return errorResponse("bank_account_already_exists", "This bank account is already on file.", 409);
      }
      if (param === "country" || /country/i.test(msg)) {
        return errorResponse("country_not_supported", "That country isn't supported for this payout account.", 400);
      }
      if (param.includes("account_number") || param.includes("routing_number") || code.includes("routing")) {
        return errorResponse("invalid_bank_details", "Those bank details were rejected — please double-check them.", 400);
      }
      return errorResponse("invalid_bank_details", "Those bank details couldn't be validated — please double-check them.", 400);
    }
  }
  return errorResponse("stripe_api_error", "Your bank couldn't be added right now. Try again in a moment.", 502);
}
