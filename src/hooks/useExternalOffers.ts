import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_LISTING_COLUMNS, type PublicListing } from "@/components/external/PublishedExternalListings";

/**
 * Offers found outside Kretopia (gigs a curator approved against their original source), for the Match deck.
 *
 * What an answer is: a swipe row, exactly like the one a person gets, with target_type 'opportunity' (the table already allows it,
 * nothing else writes it) and the listing's id. Nobody else can read it (a swipe is only visible to its author and to its target, and
 * a listing is not a member), no notification is sent, nothing is applied for, and no match can come out of it. "Interested" means
 * "keep this in view"; going to the publisher's page is a separate, explicit tap.
 *
 * It never throws and never blocks the deck: a failed read means no offers, a failed write means the card is still removed for
 * this session so it does not come straight back.
 */
const MAX_OFFERS = 30;
const seenKey = (userId: string) => `external_offers_seen_${userId}`;

function readSeen(userId: string): string[] {
  try {
    const raw = sessionStorage.getItem(seenKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeSeen(userId: string, ids: string[]) {
  try {
    sessionStorage.setItem(seenKey(userId), JSON.stringify(ids.slice(-200)));
  } catch {
    /* storage unavailable: the card just may come back after a reload */
  }
}

export function useExternalOffers(userId: string | undefined, enabled: boolean) {
  const [offers, setOffers] = useState<PublicListing[]>([]);

  useEffect(() => {
    if (!enabled || !userId) {
      setOffers([]);
      return;
    }
    let live = true;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the view is not in the generated types yet
        const { data: rows, error } = await (supabase.from("public_external_listings" as any) as any).select(PUBLIC_LISTING_COLUMNS).eq("kind", "gig").order("last_checked_at", { ascending: false, nullsFirst: false }).limit(MAX_OFFERS);
        if (error || !Array.isArray(rows) || rows.length === 0) {
          if (live) setOffers([]);
          return;
        }
        const listings = (rows as PublicListing[]).filter((r) => r?.id && r.title);
        const { data: answered } = await supabase.from("swipes").select("target_id").eq("user_id", userId).eq("target_type", "opportunity").in("target_id", listings.map((r) => r.id));
        const done = new Set<string>([...(answered ?? []).map((s: { target_id: string }) => s.target_id), ...readSeen(userId)]);
        if (live) setOffers(listings.filter((r) => !done.has(r.id)));
      } catch (e) {
        console.warn("[useExternalOffers] offers unavailable", e);
        if (live) setOffers([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId, enabled]);

  /** Answer an offer. It leaves the deck at once; the return value says whether the answer was saved. */
  const resolve = useCallback(
    async (offer: PublicListing, direction: "left" | "right"): Promise<boolean> => {
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      if (!userId) return false;
      try {
        const { error } = await supabase.from("swipes").insert({ user_id: userId, target_id: offer.id, target_type: "opportunity", direction });
        // 23505: already answered elsewhere (another tab). The card is gone either way.
        if (error && (error as { code?: string }).code !== "23505") throw error;
        return !error;
      } catch (e) {
        console.warn("[useExternalOffers] answer not saved", e);
        writeSeen(userId, [...readSeen(userId), offer.id]);
        return false;
      }
    },
    [userId],
  );

  /** Take the last answer back: the card returns to the front of the deck. */
  const restore = useCallback(
    async (offer: PublicListing) => {
      if (userId) {
        try {
          await supabase.from("swipes").delete().eq("user_id", userId).eq("target_id", offer.id).eq("target_type", "opportunity");
        } catch {
          /* the card comes back for this session anyway */
        }
        writeSeen(userId, readSeen(userId).filter((id) => id !== offer.id));
      }
      setOffers((prev) => (prev.some((o) => o.id === offer.id) ? prev : [offer, ...prev]));
    },
    [userId],
  );

  return { offers, resolve, restore };
}
