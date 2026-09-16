import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Free exchange rate API (no key needed) with fallback rates
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, INR: 83.1, NGN: 1550,
  KES: 153, BRL: 4.97, ZAR: 18.6, AED: 3.67, IDR: 15650, TTD: 6.78,
  CHF: 0.88, CAD: 1.36, AUD: 1.53, PHP: 56.2, MXN: 17.1, SGD: 1.34,
  HKD: 7.82, NZD: 1.64, SEK: 10.4, NOK: 10.5, DKK: 6.87, CNY: 7.24,
  KRW: 1320, THB: 35.5, MYR: 4.72, TWD: 31.5, PKR: 278, BDT: 110,
  VND: 24500, EGP: 30.9, GHS: 12.5, TZS: 2510, UGX: 3800, RWF: 1250,
  XOF: 605, XAF: 605, JMD: 155, BBD: 2.0, GYD: 209, BSD: 1.0,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from, to, amount } = await req.json();

    if (!from || !to) {
      throw new Error("'from' and 'to' currencies are required");
    }

    let rates: Record<string, number> = { ...FALLBACK_RATES };
    let rateSource = "fallback";

    // Try fetching live rates from a free API
    try {
      const resp = await fetch(
        `https://api.exchangerate-api.com/v4/latest/USD`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        rates = data.rates;
        rateSource = "live";
      }
    } catch {
      console.log("Using fallback rates");
    }

    const fromRate = rates[from.toUpperCase()];
    const toRate = rates[to.toUpperCase()];

    if (!fromRate || !toRate) {
      throw new Error(`Unsupported currency: ${!fromRate ? from : to}`);
    }

    // Convert: amount in 'from' → USD → 'to'
    const usdAmount = (amount || 1) / fromRate;
    const convertedAmount = usdAmount * toRate;
    const exchangeRate = toRate / fromRate;

    return new Response(JSON.stringify({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount: amount || 1,
      converted: Math.round(convertedAmount * 100) / 100,
      rate: Math.round(exchangeRate * 10000) / 10000,
      source: rateSource,
      rates, // send all rates so client can cache
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
