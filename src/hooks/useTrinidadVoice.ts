import { useEffect, useState } from "react";
import { useCurrentGeoCountry } from "./useCurrentGeoCountry";
import { useAccountTone } from "./useAccountTone";

const OPT_IN_KEY = "voice:caribbean:v1";

/**
 * Caribbean Voice Layer — gates Trini-flavored copy.
 *
 * Rules:
 *   - ON when geo detects Trinidad & Tobago (or Port of Spain) AND tone === 'creative'
 *   - OR when user has explicitly opted in (diaspora) via setOptIn(true)
 *   - OFF for business/company accounts always (B2B stays neutral)
 *   - OFF when geo unknown / international (international funnel stays clean)
 *
 * Use `voice.pick(neutral, trini)` inline to swap copy.
 */
export function useTrinidadVoice() {
  const { geo, loading: geoLoading } = useCurrentGeoCountry();
  const { isCreative, isBusiness } = useAccountTone();
  const [optIn, setOptInState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(OPT_IN_KEY) === "1"; } catch { return false; }
  });

  // Listen for changes from other tabs / settings panel
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === OPT_IN_KEY) setOptInState(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isTTGeo =
    geo?.country === "Trinidad and Tobago" ||
    geo?.country === "Trinidad" ||
    geo?.city === "Port of Spain";

  // Hard rule: business mode never gets dialect, regardless of geo or opt-in
  const enabled = !isBusiness && (optIn || (isTTGeo && isCreative));

  const setOptIn = (next: boolean) => {
    try { window.localStorage.setItem(OPT_IN_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    setOptInState(next);
  };

  return {
    enabled,
    isTTGeo,
    optIn,
    setOptIn,
    loading: geoLoading,
    /** Swap a value based on whether Caribbean voice is active. */
    pick: <T,>(neutral: T, trini: T): T => (enabled ? trini : neutral),
  };
}
