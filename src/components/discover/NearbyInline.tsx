import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { NearbyCreatorsMap } from "@/components/nearby/NearbyCreatorsMap";

interface NearbyCreator {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  bio: string | null;
  location: string | null;
  professional_skills: any;
  latitude: number;
  longitude: number;
  distance_km: number;
}

/**
 * Compact, inline Nearby for the Discover › People tab.
 * No route change — locates user, shows map + a short list. Full atlas lives at /nearby.
 */
export const NearbyInline = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [creators, setCreators] = useState<NearbyCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<NearbyCreator | null>(null);

  // Bootstrap from saved profile location
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("latitude, longitude")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.latitude && data?.longitude) {
          setLoc({ lat: data.latitude, lng: data.longitude });
        }
      } catch {
        /* noop */
      }
    })();
  }, [user]);

  // Fetch creators when we have a location
  useEffect(() => {
    if (!loc) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.rpc("get_nearby_creators", {
          user_lat: loc.lat,
          user_lon: loc.lng,
          radius_km: 50,
          limit_count: 30,
        });
        setCreators((data || []) as NearbyCreator[]);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, [loc]);

  const detect = useCallback(async () => {
    setLocating(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 300000,
        })
      );
      const { latitude, longitude } = pos.coords;
      setLoc({ lat: latitude, lng: longitude });
      if (user) {
        try {
          await supabase.rpc("update_my_location", { lat: latitude, lon: longitude });
        } catch {
          /* noop */
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't get your location");
    } finally {
      setLocating(false);
    }
  }, [user]);

  if (!loc) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--energy))]/10 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-[hsl(var(--energy))]" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-sm">See who's working near you</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Drop a pin and we'll pull up the creators in your scene.
            </p>
          </div>
          <Button onClick={detect} disabled={locating} size="sm" className="gap-1.5">
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
            Use my location
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <NearbyCreatorsMap
        creators={creators as any}
        userLocation={loc}
        selectedCreator={selected as any}
        onSelectCreator={(c) => setSelected(c as any)}
        loading={loading}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{creators.length} within 50km</span>
        <button
          onClick={() => navigate("/nearby")}
          className="font-semibold text-[hsl(var(--energy))] hover:underline"
        >
          Open full atlas →
        </button>
      </div>

      {selected && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
              {selected.avatar_url && (
                <img src={selected.avatar_url} alt={selected.full_name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{selected.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selected.role} · {selected.distance_km < 1
                  ? `${Math.round(selected.distance_km * 1000)}m`
                  : `${selected.distance_km.toFixed(1)}km`} away
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/profile/${selected.user_id}`)}>
              View
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
