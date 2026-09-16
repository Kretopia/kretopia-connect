import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, CheckCircle2, ArrowRight, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Default invite code for OG users
  const defaultInviteCode = "THRIVEOGS";
  // Use custom domain
  const baseUrl = "https://kretopia.com";
  const joinUrl = `${baseUrl}/join/${defaultInviteCode}`;
  useEffect(() => {
    // Track install page view
    const trackView = async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.pageView("install");
    };
    trackView();

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Track install attempt
    const { analytics } = await import("@/lib/analytics");
    analytics.featureUsed("pwa_install_prompt");

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      analytics.featureUsed("pwa_installed");
    } else {
      analytics.featureUsed("pwa_install_dismissed");
    }
    setDeferredPrompt(null);
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1200;
      
      if (ctx) {
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR code centered
        ctx.drawImage(img, 100, 150, 800, 800);
        
        // Add text
        ctx.fillStyle = "#000000";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Join Kretopia", canvas.width / 2, 80);
        
        ctx.font = "28px Arial";
        ctx.fillStyle = "#666666";
        ctx.fillText("Scan to join with invite code", canvas.width / 2, 1050);
        ctx.fillText("Code: " + defaultInviteCode, canvas.width / 2, 1100);
      }

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "Kretopia-Invite-QR.png";
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: "Downloaded!",
        description: "QR code saved to your device",
      });
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleShareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Kretopia",
          text: `Join Kretopia with invite code ${defaultInviteCode}`,
          url: joinUrl,
        });
      } catch (error) {
        // User cancelled or error
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast({
        title: "Invite Link Copied!",
        description: `Share this link with code ${defaultInviteCode}`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">Already Installed!</h1>
            <p className="text-muted-foreground">
              Kretopia is installed on your device. You can find it on your home screen.
            </p>
            <Button onClick={() => navigate("/circle")} className="w-full">
              Open App <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Install Kretopia</h1>
            <p className="text-muted-foreground">
              Add Kretopia to your home screen for the best experience
            </p>
          </div>

          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Install App
            </Button>
          ) : !isIOS ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">To install on Android:</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tap the menu (⋮) in your browser → "Install app" or "Add to Home screen"
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate("/auth")} 
                className="w-full"
              >
                Already installed? Sign Up
              </Button>
            </div>
          ) : null}

          {isIOS && (
            <div className="space-y-4">
              <p className="text-sm text-center font-medium">To install on iPhone/iPad:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">1. Tap Share</p>
                    <p className="text-xs text-muted-foreground">
                      Tap the share button at the bottom of Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">2. Add to Home Screen</p>
                    <p className="text-xs text-muted-foreground">
                      Scroll down and tap "Add to Home Screen"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">3. Confirm</p>
                    <p className="text-xs text-muted-foreground">
                      Tap "Add" in the top right corner
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate("/auth")} 
                className="w-full mt-4"
              >
                Already installed? Sign Up
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-3">Why install?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Faster access from your home screen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Works offline
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Full-screen experience
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                No app store needed
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t space-y-4">
            <Button 
              variant="outline" 
              onClick={() => setShowQR(!showQR)} 
              className="w-full gap-2"
            >
              <QrCode className="h-4 w-4" />
              {showQR ? "Hide QR Code" : "Get Invite QR Code"}
            </Button>

            {showQR && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div ref={qrRef} className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG
                      value={joinUrl}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Share this QR code so others can join with your invite code
                </p>
                <p className="text-center text-xs font-mono bg-primary/10 text-primary py-1 px-2 rounded">
                  Code: {defaultInviteCode}
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleDownloadQR} size="sm" className="flex-1 gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button onClick={handleShareQR} variant="outline" size="sm" className="flex-1 gap-2">
                    <Share className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => navigate("/auth")} className="w-full" size="lg">
            Skip — Sign Up Now <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full text-muted-foreground">
            Continue in Browser
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
