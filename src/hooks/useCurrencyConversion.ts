import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "TTD", symbol: "TT$", name: "Trinidad Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "JMD", symbol: "J$", name: "Jamaican Dollar" },
  { code: "GYD", symbol: "G$", name: "Guyanese Dollar" },
  { code: "BBD", symbol: "Bds$", name: "Barbadian Dollar" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

const CACHE_KEY = "thrivein_exchange_rates";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

export function useCurrencyConversion() {
  const { user } = useAuth();
  const [preferredCurrency, setPreferredCurrency] = useState<string>("USD");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  // Load user's preferred currency
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_currency) {
          setPreferredCurrency(data.preferred_currency);
        }
      });
  }, [user]);

  // Fetch exchange rates (with cache)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedRates = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setRates(parsed.rates);
          setLoading(false);
          return;
        }
      } catch {}
    }

    supabase.functions
      .invoke("convert-currency", {
        body: { from: "USD", to: "USD", amount: 1 },
      })
      .then(({ data, error }) => {
        if (!error && data?.rates) {
          setRates(data.rates);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ rates: data.rates, timestamp: Date.now() })
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Update preferred currency in DB
  const updatePreferredCurrency = useCallback(
    async (currency: string) => {
      setPreferredCurrency(currency);
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ preferred_currency: currency } as any)
        .eq("user_id", user.id);
    },
    [user]
  );

  // Convert amount from one currency to preferred
  const convert = useCallback(
    (amount: number, fromCurrency: string = "USD"): number => {
      if (!rates || fromCurrency === preferredCurrency) return amount;
      const fromRate = rates[fromCurrency.toUpperCase()] || 1;
      const toRate = rates[preferredCurrency.toUpperCase()] || 1;
      return Math.round((amount / fromRate) * toRate * 100) / 100;
    },
    [rates, preferredCurrency]
  );

  // Format with correct symbol
  const formatAmount = useCallback(
    (amount: number, fromCurrency: string = "USD"): string => {
      const converted = convert(amount, fromCurrency);
      const curr = SUPPORTED_CURRENCIES.find(
        (c) => c.code === preferredCurrency
      );
      const symbol = curr?.symbol || preferredCurrency + " ";

      // For currencies with no decimals (JPY, KRW, IDR, VND)
      const noDecimals = ["JPY", "KRW", "IDR", "VND"].includes(
        preferredCurrency
      );
      const formatted = noDecimals
        ? Math.round(converted).toLocaleString()
        : converted.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

      return `${symbol}${formatted}`;
    },
    [convert, preferredCurrency]
  );

  const getCurrencySymbol = useCallback(
    (code?: string): string => {
      const c = code || preferredCurrency;
      return (
        SUPPORTED_CURRENCIES.find((cur) => cur.code === c)?.symbol || c + " "
      );
    },
    [preferredCurrency]
  );

  return {
    preferredCurrency,
    updatePreferredCurrency,
    convert,
    formatAmount,
    getCurrencySymbol,
    rates,
    loading,
    SUPPORTED_CURRENCIES,
  };
}
