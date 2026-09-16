import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Award, CheckCircle, ArrowLeft } from "lucide-react";

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const qrCode = searchParams.get("code");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!qrCode) {
      toast({
        title: "Invalid QR Code",
        description: "No location code provided",
        variant: "destructive",
      });
      navigate("/membership");
      return;
    }

    fetchLocation();
  }, [user, qrCode]);

  const fetchLocation = async () => {
    try {
      const { data, error } = await supabase
        .from("partner_locations")
        .select("*")
        .eq("qr_code", qrCode)
        .eq("is_active", true)
        .single();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Location Not Found",
          description: "This QR code is not valid",
          variant: "destructive",
        });
        navigate("/membership");
        return;
      }

      setLocation(data);
    } catch (error) {
      console.error("Error fetching location:", error);
      toast({
        title: "Error",
        description: "Failed to load location details",
        variant: "destructive",
      });
      navigate("/membership");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!user || !location) return;

    setChecking(true);

    try {
      // Get user's current position
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        }
      );

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Calculate distance using database function
      const { data: distanceData, error: distanceError } = await supabase.rpc(
        "calculate_distance",
        {
          lat1: userLat,
          lon1: userLng,
          lat2: location.latitude,
          lon2: location.longitude,
        }
      );

      if (distanceError) throw distanceError;

      const distance = distanceData as number;

      // Check if within radius
      if (distance > location.check_in_radius_meters) {
        toast({
          title: "Too Far Away",
          description: `You must be within ${location.check_in_radius_meters}m of ${location.name} to check in. You are ${Math.round(distance)}m away.`,
          variant: "destructive",
        });
        setChecking(false);
        return;
      }

      // Check if already checked in today
      const today = new Date().toISOString().split("T")[0];
      const { data: existingCheckIn } = await supabase
        .from("user_check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("location_id", location.id)
        .gte("check_in_date", today)
        .maybeSingle();

      if (existingCheckIn) {
        toast({
          title: "Already Checked In",
          description: "You've already checked in here today!",
          variant: "destructive",
        });
        setChecking(false);
        return;
      }

      // Create check-in
      const { error: checkInError } = await supabase
        .from("user_check_ins")
        .insert({
          user_id: user.id,
          location_id: location.id,
          points_awarded: location.points_per_visit,
          check_in_date: today,
        });

      if (checkInError) throw checkInError;

      // Points are awarded server-side
      await supabase.rpc("award_xp" as any, {
        p_user_id: user.id,
        p_amount: location.points_per_visit,
        p_reason: "location_check_in",
      });

      toast({
        title: "Check-in Successful!",
        description: `You earned ${location.points_per_visit} points at ${location.name}`,
      });

      // Redirect to membership page
      setTimeout(() => {
        navigate("/membership");
      }, 2000);
    } catch (error: any) {
      console.error("Check-in error:", error);

      if (error.code === 1) {
        toast({
          title: "Location Access Denied",
          description:
            "Please enable location permissions to check in at partner locations",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check-in Failed",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate("/membership")}
        className="gap-2 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="max-w-md mx-auto">
        <Card className="overflow-hidden">
          {location.image_url && (
            <img
              src={location.image_url}
              alt={location.name}
              className="w-full h-48 object-cover"
            />
          )}
          
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{location.name}</h1>
                <p className="text-muted-foreground capitalize">
                  {location.type}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{location.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {location.city}, {location.country}
                </span>
              </div>
            </div>

            {location.description && (
              <p className="text-sm text-muted-foreground">
                {location.description}
              </p>
            )}

            <div className="bg-primary/5 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  Earn {location.points_per_visit} Points
                </span>
              </div>
            </div>

            <Button
              onClick={handleCheckIn}
              disabled={checking}
              className="w-full"
              size="lg"
            >
              {checking ? (
                "Checking in..."
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Check In Now
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You must be within {location.check_in_radius_meters}m to check in
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
