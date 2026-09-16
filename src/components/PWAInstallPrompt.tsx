import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'thrivein-pwa-prompt-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS instructions after delay
      const timer = setTimeout(() => setShowBanner(true), 60000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 60000); // 1 min delay
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Get Kretopia App</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS 
                ? 'Tap the share button, then "Add to Home Screen"'
                : 'Install for a faster, native-like experience'
              }
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={handleDismiss} aria-label="Dismiss install prompt">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {!isIOS && deferredPrompt && (
          <Button size="sm" className="w-full mt-3" onClick={handleInstall}>
            Install Now
          </Button>
        )}
        {isIOS && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Share className="h-4 w-4" />
            <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
