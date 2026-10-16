// Pure request check for `wallet-add-bank` (a creator attaching a payout bank account).
// Imported by edge functions (Deno) and by tests (Vite). No dependency.
//
// Why: the fields were used as sent. `currency.toUpperCase()` ran AFTER a Stripe
// Connect account had been created for the caller, so a crafted request (a
// currency that passes `String(x).toUpperCase()` but is not text) left an
// orphan Connect account behind and answered 500; `make_default` went to Stripe
// as any truthy value; text fields had no bounds; and an idempotency key that
// was not text was replaced by a random one, silently dropping retry safety.
// Everything is now checked before the first Stripe call.

export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;
export const MAX_HOLDER_NAME_LENGTH = 140;

export interface BankRequest {
  country: string; // two letters, upper case
  currency: string; // three letters, upper case
  accountHolderName: string;
  accountNumber: string; // no spaces, letters and digits only
  routingNumber: string | null; // no spaces or dashes
  makeDefault: boolean;
  idempotencyKey: string | null;
}

export type BankRequestCheck =
  | { ok: true; request: BankRequest }
  | { ok: false; code: "invalid_bank_details"; error: string };

const bad = (error: string): BankRequestCheck => ({ ok: false, code: "invalid_bank_details", error });

function text(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function cleanBankRequest(body: unknown): BankRequestCheck {
  const b = (body ?? {}) as Record<string, unknown>;

  const country = typeof b.country === "string" ? b.country.trim().toUpperCase() : "";
  const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "";
  const holder = typeof b.account_holder_name === "string" ? b.account_holder_name.trim() : "";
  const accountRaw = text(b.account_number);
  if (!country || !currency || !holder || !accountRaw) return bad("Fill in all required fields.");

  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) return bad("Fill in all required fields.");
  if (holder.length > MAX_HOLDER_NAME_LENGTH) return bad("That account holder name is too long.");

  const accountNumber = accountRaw.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9]{4,34}$/.test(accountNumber)) return bad("Those bank details were rejected — please double-check them.");

  let routingNumber: string | null = null;
  if (b.routing_number !== undefined && b.routing_number !== null && b.routing_number !== "") {
    const routingRaw = text(b.routing_number);
    const cleaned = routingRaw ? routingRaw.replace(/[-\s]+/g, "") : "";
    if (!/^[A-Za-z0-9]{3,20}$/.test(cleaned)) return bad("Those bank details were rejected — please double-check them.");
    routingNumber = cleaned;
  }

  let makeDefault = true;
  if (b.make_default !== undefined && b.make_default !== null) {
    if (typeof b.make_default !== "boolean") return bad("Fill in all required fields.");
    makeDefault = b.make_default;
  }

  let idempotencyKey: string | null = null;
  const key = b.idempotencyKey;
  if (key !== undefined && key !== null && key !== "") {
    if (typeof key !== "string" || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) return bad("Invalid idempotency key");
    idempotencyKey = key;
  }

  return {
    ok: true,
    request: {
      country,
      currency,
      accountHolderName: holder,
      accountNumber,
      routingNumber,
      makeDefault,
      idempotencyKey,
    },
  };
}
