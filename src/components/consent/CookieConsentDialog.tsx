import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPEN_COOKIE_SETTINGS, readCookieConsent, saveCookieConsent } from "@/lib/cookieConsent";

/**
 * The cookie choice, centred, the first time a device opens Kretopia (and again from "Cookie settings"). Short on purpose: essential
 * storage is always on and says why; analytics is one switch, off until the person turns it on. "Essential only" is as easy as
 * "Accept all", and there is no close-without-choosing that would count as a yes.
 */
export function CookieConsentDialog() {
  const [open, setOpen] = useState(() => readCookieConsent() === null);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(() => readCookieConsent()?.analytics ?? false);

  useEffect(() => {
    const reopen = () => {
      setAnalytics(readCookieConsent()?.analytics ?? false);
      setCustomise(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
  }, []);

  const decide = (allowAnalytics: boolean) => {
    saveCookieConsent(allowAnalytics);
    setOpen(false);
    setCustomise(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) setOpen(true); /* closing only through a choice */ }}>
      <DialogContent
        className="max-w-md rounded-2xl [&>button.absolute]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle>Cookies on Kretopia</DialogTitle>
          <DialogDescription>
            We use essential storage to keep you signed in and secure. With your permission, we also measure how Kretopia is used,
            to make it better. No advertising trackers.{" "}
            <a href="/privacy#s08" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
              Privacy Policy
            </a>
          </DialogDescription>
        </DialogHeader>

        {customise && (
          <div className="space-y-2" role="group" aria-label="Cookie categories">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Essential</p>
                <p className="text-xs text-muted-foreground">Sign-in, security, your preferences and offline use. Always on.</p>
              </div>
              <Switch checked disabled aria-label="Essential cookies, always on" />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Analytics</p>
                <p className="text-xs text-muted-foreground">Kretopia's own usage measurement and masked error replays. Off unless you turn it on.</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Analytics cookies" />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {customise ? (
            <Button className="w-full" onClick={() => decide(analytics)}>Save my choices</Button>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => decide(false)}>Essential only</Button>
              <Button onClick={() => decide(true)}>Accept all</Button>
            </div>
          )}
          {!customise && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setCustomise(true)}>
              Customise
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
