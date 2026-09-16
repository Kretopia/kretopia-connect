import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HoloCard } from "@/components/passport/HoloCard";
import { BrandLogo } from "@/components/BrandLogo";
import QRCodeStyling from "qr-code-styling";
import { Loader2, Ticket, Check, Calendar, MapPin, CalendarPlus, Navigation } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";

const ENERGY = "#FF2DA1";
const MIDNIGHT = "#0B0B10";

interface EventPassCardProps {
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
}

/**
 * The Kretopia-branded event pass — same holographic-card, ambient-glow and
 * scan-line language as the rest of the app (HoloCard, KretopiaHero's
 * search treatment), with the Kretopia mark embedded straight into the QR
 * code so the pass reads as unmistakably Kretopia even when it's just a
 * photo of a screen at a door. The QR is the dominant element on the card
 * by design — everything else (venue, calendar, directions) sits below it.
 */
export const EventPassCard = ({
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
}: EventPassCardProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !token || !qrRef.current) return;
    let cancelled = false;
    qrRef.current.innerHTML = "";

    const baseOptions = {
      width: 240,
      height: 240,
      data: token,
      margin: 8,
      qrOptions: { errorCorrectionLevel: "H" as const },
      dotsOptions: {
        type: "extra-rounded" as const,
        gradient: {
          type: "linear" as const,
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: MIDNIGHT },
            { offset: 1, color: ENERGY },
          ],
        },
      },
      cornersSquareOptions: { color: ENERGY, type: "extra-rounded" as const },
      cornersDotOptions: { color: MIDNIGHT, type: "dot" as const },
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
  }, [token, loading]);

  return (
    <HoloCard className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Header — same cinematic plate signature as the landing hero / feature headers, theme-aware */}
        <div className="relative overflow-hidden px-5 pt-5 pb-6 text-center" style={{ backgroundColor: "hsl(var(--background))" }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 ai-ambient-breathe"
            style={{ background: `radial-gradient(70% 60% at 50% 0%, ${ENERGY}26, transparent 65%)` }}
          />
          <div className="relative flex flex-col items-center">
            <BrandLogo size="sm" lockup />
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: ENERGY, backgroundColor: `${ENERGY}1A`, border: `1px solid ${ENERGY}40` }}
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

        {/* QR — the priority element on the card, framed with the same ambient-glow + scan-line signature used across Kretopia's AI-powered surfaces */}
        <div className="relative px-5 pt-5 pb-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-2 top-2 h-64 rounded-[32px] blur-2xl opacity-70 ai-ambient-breathe"
            style={{ background: `radial-gradient(60% 100% at 50% 30%, ${ENERGY}22, transparent 70%)` }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-3 h-px overflow-hidden rounded-full">
            <div
              className="ai-scan-line h-full w-1/3"
              style={{ background: `linear-gradient(90deg, transparent, ${ENERGY}, transparent)` }}
            />
          </div>

          <div className="relative flex flex-col items-center">
            {loading ? (
              <div className="h-[240px] w-[240px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : token ? (
              <>
                <div
                  className="rounded-2xl p-3 bg-white"
                  style={{ boxShadow: `0 0 0 1px ${ENERGY}30, 0 12px 40px -12px ${ENERGY}55` }}
                  ref={qrRef}
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
              {format(new Date(startTime), "EEE, MMM d · h:mm a")}
            </span>
          </div>
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
    </HoloCard>
  );
};

export default EventPassCard;
