import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import QRCodeStyling from "qr-code-styling";
import { Ticket, Check, Calendar, MapPin, CalendarPlus, Navigation, X } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";
import { buildPassUrl, publicUrl } from "@/lib/publicLink";

interface EventPassCardProps {
  /** The event the pass is for: the code encodes the pass page of this event, never the token alone. */
  eventId: string;
  eventTitle: string;
  guestName?: string | null;
  startTime: string;
  venueName?: string | null;
  venueAddress?: string | null;
  token: string | null;
  loading: boolean;
  checkedIn?: boolean;
  onDownloadCalendar?: () => void;
  directionsHref?: string | null;
  className?: string;
  /** When set, a close (X) control is drawn inside the card's top-right corner. */
  onClose?: () => void;
}

/**
 * The Kretopia-branded event pass keeps the QR prominent and scannable
 * without pointer-tracked or animated effects.
 */
export const EventPassCard = ({
  eventId,
  eventTitle,
  guestName,
  startTime,
  venueName,
  venueAddress,
  token,
  loading,
  checkedIn = false,
  onDownloadCalendar,
  directionsHref,
  className,
  onClose,
}: EventPassCardProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  // What the code carries: the public address of this pass (a link a phone can open), never the bare check-in token.
  const passLink = token && eventId ? publicUrl(buildPassUrl(eventId, token)) : undefined;

  useEffect(() => {
    if (loading || !passLink || !qrRef.current) return;
    let cancelled = false;
    qrRef.current.innerHTML = "";

    const styles = getComputedStyle(document.documentElement);
    const foreground = styles.getPropertyValue("--foreground").trim();
    const background = styles.getPropertyValue("--background").trim();
    if (!foreground || !background) return;
    const foregroundLightness = Number(foreground.match(/(\d+(?:\.\d+)?)%\s*$/)?.[1]);
    if (!Number.isFinite(foregroundLightness)) return;
    const inkToken = foregroundLightness > 50 ? background : foreground;
    const qrForeground = `hsl(${inkToken})`;
    const baseOptions = {
      width: 240,
      height: 240,
      data: passLink,
      margin: 8,
      // A link is longer than the token was: Q (25%) keeps the code coarse enough to read from a screen, and still survives the logo.
      qrOptions: { errorCorrectionLevel: "Q" as const },
      dotsOptions: { type: "extra-rounded" as const, color: qrForeground },
      cornersSquareOptions: { color: qrForeground, type: "extra-rounded" as const },
      cornersDotOptions: { color: qrForeground, type: "dot" as const },
      backgroundOptions: { color: "#ffffff" },
    };

    const render = (withLogo: boolean) => {
      if (cancelled || !qrRef.current) return;
      const qr = new QRCodeStyling(
        withLogo
          ? {
              ...baseOptions,
              image: kMarkAsset.url,
              imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 6, crossOrigin: "anonymous" },
            }
          : baseOptions,
      );
      qr.append(qrRef.current);
    };

    // Embedding the Kretopia mark in the middle is a branding touch, never
    // a dependency the pass can fail on -- qr-code-styling renders a blank
    // canvas (not a graceful fallback) when the center image fails to load,
    // and a door pass that silently goes blank is worse than one without
    // the logo. Pre-check the image loads before handing it to the QR
    // library; fall back to a plain (still gradient/branded) QR otherwise.
    const probe = new Image();
    probe.onload = () => render(true);
    probe.onerror = () => render(false);
    probe.src = kMarkAsset.url;

    return () => {
      cancelled = true;
    };
  }, [passLink, loading]);

  return (
      <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
        <div className="relative overflow-hidden px-5 pt-5 pb-6 text-center" style={{ backgroundColor: "hsl(var(--background))" }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close pass"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/70 text-foreground/70 transition-colors hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="relative flex flex-col items-center">
            <BrandLogo size="sm" lockup />
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.25)" }}
            >
              <Ticket className="h-3 w-3" /> Your pass
            </div>
            <h2 className="text-xl font-bold mt-2 leading-tight text-foreground">{eventTitle}</h2>
            {guestName && <p className="text-sm text-foreground/60 mt-0.5">{guestName}</p>}
          </div>
        </div>

        {/* Perforated edge */}
        <div className="relative h-3 bg-card">
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background" />
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background" />
          <div className="border-t border-dashed border-border mx-3 mt-1.5" />
        </div>

        <div className="px-5 pt-5 pb-2">
          <div className="relative flex flex-col items-center">
            {loading ? (
              <div className="h-[240px] w-[240px] flex items-center justify-center">
                <KretopiaSpinner className="h-6 w-6 text-primary" />
              </div>
            ) : token ? (
              <>
                <div
                  className="rounded-2xl bg-white p-3 shadow-[0_12px_40px_-12px_hsl(var(--primary)/.3)]"
                  ref={qrRef}
                  role="img"
                  aria-label="Pass QR code: scan it to open this pass"
                />
                {checkedIn ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
                    <Check className="h-4 w-4" /> You're checked in
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground text-center">
                    Show this to the host at the door
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/70 font-mono tracking-wide">
                  {token.slice(0, 8)}…{token.slice(-4)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                We couldn't find your pass. Try refreshing the event.
              </p>
            )}
          </div>
        </div>

        {/* Event meta — same icon-tile pattern as the event detail page */}
        <div className="px-5 pb-5 pt-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">
              Your local time · {formatEventTime(startTime)}
            </span>
          </div>
          <p className="pl-12 text-xs text-muted-foreground">Timezone · {eventTimeZone()}</p>
          {venueName && (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{venueName}</p>
                {venueAddress && <p className="text-xs text-muted-foreground line-clamp-1">{venueAddress}</p>}
              </div>
            </div>
          )}

          {(onDownloadCalendar || directionsHref) && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {onDownloadCalendar && (
                <Button onClick={onDownloadCalendar} variant="secondary" size="sm">
                  <CalendarPlus className="h-4 w-4 mr-1.5" /> Calendar
                </Button>
              )}
              {directionsHref ? (
                <a href={directionsHref} target="_blank" rel="noopener noreferrer" className={cn(!onDownloadCalendar && "col-span-2")}>
                  <Button variant="secondary" size="sm" className="w-full">
                    <Navigation className="h-4 w-4 mr-1.5" /> Directions
                  </Button>
                </a>
              ) : onDownloadCalendar ? (
                <Button variant="secondary" size="sm" disabled>
                  <Navigation className="h-4 w-4 mr-1.5" /> Directions
                </Button>
              ) : null}
            </div>
          )}

          <p className="pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/50">
            Kretopia · Where Creativity Lives
          </p>
        </div>
      </div>

  );
};

export default EventPassCard;
