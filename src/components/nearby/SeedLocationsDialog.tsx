import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, MapPin } from "lucide-react";

interface SeedLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { lat: number; lng: number };
  onSeeded: () => void;
}

export function SeedLocationsDialog({ open, onOpenChange, userLocation, onSeeded }: SeedLocationsDialogProps) {
  const { toast } = useToast();
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number; locations: any[] } | null>(null);

  const handleSeed = async () => {
    if (!city.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("seed-atlas-locations", {
        body: {
          city: city.trim(),
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radius_km: 25,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ count: data.count, locations: data.locations || [] });
      toast({ title: `${data.count} spots discovered!`, description: `Found creative locations in ${city}` });
      onSeeded();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Spot Discovery
          </DialogTitle>
          <DialogDescription>
            Let Kreto discover studios, creative spaces, and industry spots near you — like Google Maps for creatives.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-1 block">City / Area</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Los Angeles, London, Kingston..."
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Will search within 25km of your location</span>
          </div>

          <Button onClick={handleSeed} disabled={loading || !city.trim()} className="w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Discovering spots...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Discover Creative Spots
              </>
            )}
          </Button>

          {result && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium text-primary">
                Found {result.count} creative spots!
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.locations.map((loc: any) => (
                  <div key={loc.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span></span>
                    <span className="font-medium text-foreground">{loc.name}</span>
                    <span className="text-[10px] bg-muted px-1.5 rounded">{loc.location_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
