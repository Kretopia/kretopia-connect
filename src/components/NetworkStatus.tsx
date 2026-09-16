import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { toast } from "sonner";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
      toast.success("You're back online!", { icon: <Wifi className="h-4 w-4" /> });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Show banner if already offline on mount
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium animate-in slide-in-from-top duration-300 safe-top">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>No internet connection — some features may be unavailable</span>
      <button
        onClick={() => setShowBanner(false)}
        className="ml-2 underline underline-offset-2 opacity-80 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}
