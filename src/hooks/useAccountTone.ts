import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AccountTone = "creative" | "business";

interface ToneCopy {
  /** Word for the user's surface, e.g. "profile" / "brand page" */
  surface: string;
  /** What they "make" — used in CTAs */
  craft: string;
  /** Label for the EPK / brochure download */
  download: string;
  /** Short verb for matching, e.g. "Connect" / "Hire" */
  matchVerb: string;
  /** Microcopy for plain-mode confirmations */
  confirmTone: "warm" | "neutral";
}

const COPY: Record<AccountTone, ToneCopy> = {
  creative: {
    surface: "profile",
    craft: "creative work",
    download: "Download EPK",
    matchVerb: "Connect",
    confirmTone: "warm",
  },
  business: {
    surface: "brand page",
    craft: "brief",
    download: "Download brand one-pager",
    matchVerb: "Hire",
    confirmTone: "neutral",
  },
};

const STORAGE_KEY = "tone:v1";

function readCached(userId: string | undefined): AccountTone | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    return raw === "business" || raw === "creative" ? raw : null;
  } catch {
    return null;
  }
}

function writeCached(userId: string, tone: AccountTone) {
  try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, tone); } catch { /* ignore */ }
}

/**
 * Returns the user's account tone — "creative" (individuals) or "business" (companies/brands).
 * Drives copy + variant choices across the platform without forking components.
 *
 * Source of truth: profiles.account_type ('company' → business, anything else → creative).
 * Cached in localStorage so first render doesn't flash.
 */
export function useAccountTone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["account-tone", user?.id];
  const { data, isPending } = useQuery({
    queryKey,
    enabled: !!user,
    initialData: readCached(user?.id) ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<AccountTone> => {
      if (!user) return "creative";
      const { data, error } = await supabase.from("profiles")
        .select("account_type").eq("user_id", user.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      const next = data?.account_type === "company" ? "business" : "creative";
      writeCached(user.id, next);
      return next;
    },
  });
  const tone: AccountTone = user ? data ?? "creative" : "creative";

  // Publish only after the profile update succeeds; cancel stale reads first.
  const updateAccountType = async (accountType: "individual" | "company") => {
    if (!user) return;
    await queryClient.cancelQueries({ queryKey });
    const next: AccountTone = accountType === "company" ? "business" : "creative";
    writeCached(user.id, next);
    queryClient.setQueryData(queryKey, next);
  };

  const copy = COPY[tone];
  return {
    tone,
    copy,
    isBusiness: tone === "business",
    isCreative: tone === "creative",
    loading: !!user && isPending,
    updateAccountType,
    /** Pick a value based on tone — handy inline helper. */
    pick: <T,>(creative: T, business: T): T => (tone === "business" ? business : creative),
  };
}
