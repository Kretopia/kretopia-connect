import { useEffect, useState } from "react";

const MAPBOX_TOKEN = "pk.eyJ1IjoiZXRoYW5hdWd1c3RlIiwiYSI6ImNtZzhvbDk0dzAwaHYycnB6eWp4Zjh2OHAifQ.4uCSa5SdtxZAnC2Xvx6V5w";
const CACHE_KEY = "current_geo_v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h

type GeoInfo = {
  country: string | null;
  city: string | null;
  lat: number;
  lng: number;
  ts: number;
};

/**
 * Detects the user's CURRENT physical location via browser GPS,
 * reverse-geocodes to country/city via Mapbox, and caches in sessionStorage.
 * Falls back to null silently if permission denied or unavailable —
 * callers should fall back to profile.location.
 */
export function useCurrentGeoCountry() {
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Cached?
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed: GeoInfo = JSON.parse(raw);
          if (Date.now() - parsed.ts < CACHE_TTL_MS) {
            if (!cancelled) {
              setGeo(parsed);
              setLoading(false);
            }
            return;
          }
        }

        if (!("geolocation" in navigator)) {
          setLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { latitude: lat, longitude: lng } = pos.coords;
              const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country,place&access_token=${MAPBOX_TOKEN}`;
              const res = await fetch(url).catch(() => null);
              let country: string | null = null;
              let city: string | null = null;
              if (res && res.ok) {
                const j = await res.json();
                for (const f of j.features || []) {
                  if (f.place_type?.includes("country") && !country) country = f.text;
                  if (f.place_type?.includes("place") && !city) city = f.text;
                }
              }
              const info: GeoInfo = { country, city, lat, lng, ts: Date.now() };
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
              if (!cancelled) {
                setGeo(info);
                setLoading(false);
              }
            } catch {
              if (!cancelled) setLoading(false);
            }
          },
          () => {
            if (!cancelled) setLoading(false);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 30 }
        );
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { geo, loading };
}
