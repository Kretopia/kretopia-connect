import { useState, useEffect, useRef, useCallback } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { awardCredits } from "@/lib/creditSystem";
import { Check, X, Camera } from "lucide-react";

interface QRScannerProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const QRScanner = ({ onClose, onSuccess }: QRScannerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const mountedRef = useRef(true);

  const verifyAndCheckIn = useCallback(async (qrCode: string) => {
    if (!mountedRef.current) return;
    
    setVerifying(true);
    setScanning(false);

    try {
      // Find location by QR code
      const { data: locationData, error: locationError } = await supabase
        .from("partner_locations")
        .select("*")
        .eq("qr_code", qrCode)
        .eq("is_active", true)
        .single();

      if (locationError || !locationData) {
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not recognized",
          variant: "destructive",
        });
        onClose();
        return;
      }

      if (!mountedRef.current) return;
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
          if (!mountedRef.current) return;
          
          const userLat = position.coords.latitude;
          const userLon = position.coords.longitude;

          // Calculate distance using SQL function
          const { data: distanceData } = await supabase
            .rpc("calculate_distance", {
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
            .maybeSingle();

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
            description: "Could not get your location. Please enable location services.",
            variant: "destructive",
          });
          onClose();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
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
      if (mountedRef.current) {
        setVerifying(false);
      }
    }
  }, [user, toast, onClose, onSuccess]);

  const initScanner = useCallback(() => {
    const element = document.getElementById("qr-reader");
    if (!element || !mountedRef.current) {
      console.error("QR reader element not found or component unmounted");
      return;
    }

    try {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          showTorchButtonIfSupported: true,
          useBarCodeDetectorIfSupported: true,
        },
        false
      );

      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        if (!mountedRef.current) return;
        console.log("QR Code scanned:", decodedText);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
          scannerRef.current = null;
        }
        verifyAndCheckIn(decodedText);
      };

      const onScanError = (error: any) => {
        // Ignore frequent scan errors
      };

      scanner.render(onScanSuccess, onScanError);
      
      if (mountedRef.current) {
        setScanning(true);
      }
    } catch (error) {
      console.error("Scanner initialization error:", error);
      setCameraError("Failed to initialize QR scanner");
    }
  }, [verifyAndCheckIn]);

  const requestCameraPermission = useCallback(async () => {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      // Stop the stream - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      
      if (mountedRef.current) {
        setPermissionGranted(true);
        setCameraError(null);
      }
    } catch (error: any) {
      console.error("Camera permission error:", error);
      let errorMessage = "Camera access denied";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access denied. Please enable camera permissions in your settings.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another application.";
      } else {
        errorMessage = `Camera error: ${error.message || "Unknown error"}`;
      }
      
      if (mountedRef.current) {
        setCameraError(errorMessage);
        toast({
          title: "Camera Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    mountedRef.current = true;
    requestCameraPermission();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [requestCameraPermission]);

  // Separate effect to initialize scanner when permission is granted
  useEffect(() => {
    if (permissionGranted && !scanning && !scannerRef.current) {
      // Wait for DOM to render the qr-reader element
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          initScanner();
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [permissionGranted, scanning, initScanner]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Location QR Code</DialogTitle>
        </DialogHeader>

        {cameraError ? (
          <div className="flex flex-col items-center justify-center py-8">
            <X className="h-16 w-16 text-destructive mb-4" />
            <p className="text-sm text-center text-muted-foreground mb-4">
              {cameraError}
            </p>
            <Button 
              onClick={() => {
                setCameraError(null);
                requestCameraPermission();
              }}
              variant="outline"
              className="mt-4"
            >
              <Camera className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : !permissionGranted ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
            <p className="text-sm text-muted-foreground">Requesting camera access...</p>
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
        ) : permissionGranted ? (
          <div>
            <div id="qr-reader" className="w-full" />
            {scanning && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Point your camera at the QR code
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
            <p className="text-sm text-muted-foreground">Initializing scanner...</p>
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="mt-4">
          {cameraError ? "Close" : "Cancel"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};