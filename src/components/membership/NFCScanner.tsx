import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { awardCredits } from "@/lib/creditSystem";
import { NFCReader } from "@/lib/nfcUtils";
import { Smartphone, Check } from "lucide-react";

interface NFCScannerProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NFCScanner = ({ onClose, onSuccess }: NFCScannerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(true);
  const [location, setLocation] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [nfcReader] = useState(() => new NFCReader());

  useEffect(() => {
    if (!NFCReader.isSupported()) {
      toast({
        title: "NFC Not Supported",
        description: "Your device doesn't support NFC scanning. Please use QR code instead.",
        variant: "destructive",
      });
      onClose();
      return;
    }

    // Start NFC scanning
    nfcReader.startScanning(
      async (locationCode) => {
        setScanning(false);
        await verifyAndCheckIn(locationCode);
      },
      (error) => {
        toast({
          title: "NFC Error",
          description: error.message,
          variant: "destructive",
        });
        onClose();
      }
    );

    return () => {
      nfcReader.stopScanning();
    };
  }, []);

  const verifyAndCheckIn = async (locationCode: string) => {
    setVerifying(true);

    try {
      // Find location by code (could be QR code or NFC ID)
      const { data: locationData, error: locationError } = await supabase
        .from("partner_locations")
        .select("*")
        .eq("qr_code", locationCode)
        .eq("is_active", true)
        .single();

      if (locationError || !locationData) {
        toast({
          title: "Invalid Location",
          description: "This NFC tag is not recognized",
          variant: "destructive",
        });
        onClose();
        return;
      }

      setLocation(locationData);

      // Get user's current location
      if (!navigator.geolocation) {
        toast({
          title: "Location Required",
          description: "Please enable location services",
          variant: "destructive",
        });
        onClose();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userLat = position.coords.latitude;
          const userLon = position.coords.longitude;

          // Calculate distance using SQL function
          const { data: distanceData } = await supabase.rpc("calculate_distance", {
            lat1: userLat,
            lon1: userLon,
            lat2: locationData.latitude,
            lon2: locationData.longitude,
          });

          const distance = distanceData as number;
          const withinRadius = distance <= locationData.check_in_radius_meters;

          if (!withinRadius) {
            toast({
              title: "Too Far Away",
              description: `You must be within ${locationData.check_in_radius_meters}m of the location`,
              variant: "destructive",
            });
            onClose();
            return;
          }

          // Check if already checked in today
          const today = new Date().toISOString().split("T")[0];
          const { data: existingCheckIn } = await supabase
            .from("user_check_ins")
            .select("*")
            .eq("user_id", user?.id)
            .eq("location_id", locationData.id)
            .eq("check_in_date", today)
            .single();

          if (existingCheckIn) {
            toast({
              title: "Already Checked In",
              description: "You can only check in once per day at each location",
            });
            onClose();
            return;
          }

          // Create check-in
          const { error: checkInError } = await supabase
            .from("user_check_ins")
            .insert({
              user_id: user?.id,
              location_id: locationData.id,
              points_awarded: locationData.points_per_visit,
              check_in_latitude: userLat,
              check_in_longitude: userLon,
              verified_location: withinRadius,
              check_in_date: today,
            });

          if (checkInError) {
            toast({
              title: "Check-in Failed",
              description: checkInError.message,
              variant: "destructive",
            });
            onClose();
            return;
          }

          // Award credits
          await awardCredits(
            user?.id!,
            locationData.points_per_visit,
            "location_check_in",
            `Checked in at ${locationData.name}`
          );

          toast({
            title: "Check-in Successful!",
            description: `You earned ${locationData.points_per_visit} points at ${locationData.name}`,
          });

          onSuccess();
          onClose();
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Could not get your location",
            variant: "destructive",
          });
          onClose();
        }
      );
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Error",
        description: "Failed to process check-in",
        variant: "destructive",
      });
      onClose();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tap NFC Tag</DialogTitle>
        </DialogHeader>

        {scanning ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <Smartphone className="h-24 w-24 text-primary mb-4" />
              <div className="absolute inset-0 animate-ping">
                <Smartphone className="h-24 w-24 text-primary/50" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Hold your phone near the NFC tag
            </p>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Make sure NFC is enabled in your phone settings
            </p>
          </div>
        ) : verifying ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
            <p className="text-sm text-muted-foreground">Verifying location...</p>
          </div>
        ) : location ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Check className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">{location.name}</h3>
            <p className="text-sm text-muted-foreground">Processing check-in...</p>
          </div>
        ) : null}

        <Button variant="outline" onClick={onClose} className="mt-4">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
};
