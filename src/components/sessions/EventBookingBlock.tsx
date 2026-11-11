import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle, ExternalLink, MapPin, Navigation, TriangleAlert, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useIsOnScreen } from "@/hooks/useIsOnScreen";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { openDirections } from "@/lib/eventActions";
import { placesLeftLabel, type EventBookingControl } from "@/lib/eventBookingState";
import type { EventCountdown } from "@/lib/eventCountdown";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";
import { cn } from "@/lib/utils";
import { EventAttendeeStack, type EventAttendeePreview } from "@/components/sessions/EventAttendeeStack";
import { EventBookingCta } from "@/components/sessions/EventBookingCta";
import { EventHostBlock } from "@/components/sessions/EventHostBlock";
import type { EventHost } from "@/lib/eventHostLinks";
import { EventParticipantsDialog } from "@/components/sessions/EventParticipantsDialog";
import { EventStickyBookingBar } from "@/components/sessions/EventStickyBookingBar";

/** What the last RSVP action did, in one line: the single place the page tells the viewer so (no toast and no dialog repeat it). */
export interface RsvpNotice {
  tone: "success" | "info" | "error";
  text: string;
}

interface EventBookingBlockProps {
  eventId: string;
  eventTitle: string;
  startTime: string;
  countdown: EventCountdown | null;
  isPast: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
  /** Online events have no venue and no map. */
  isOnline: boolean;
  onlineFormat?: string | null;
  venueName: string | null;
  /** Already filtered by what the viewer may see: null when the host hid the venue details. */
  venueAddress: string | null;
  /**
   * False when the host hid the Venue section: a visitor then still gets the venue's name (the listing's headline) but no address and
   * no map, here or anywhere else. The host always sees them.
   */
  venueDetailsVisible: boolean;
  isAuthenticated: boolean;
  isHost: boolean;
  /** The signed-in viewer's id, if any: it decides which rows of the participants list they may see. */
  viewerId: string | null;
  /** Price text for a paid event; null reads "Free". */
  priceLabel: string | null;
  /** Where tickets are sold when the host sells them elsewhere; a link, not a second button. */
  ticketUrl: string | null;
  /** 0 means no limit. */
  capacity: number;
  /** The server's count of people going; null while it is not known. Never an optimistic number. */
  participantCount: number | null;
  attendees: EventAttendeePreview[];
  attendeesVisible: boolean;
  control: EventBookingControl;
  /** Why the control cannot be used, from the booking state. */
  reason: string | null;
  joining: boolean;
  rsvpNotice: RsvpNotice | null;
  onDismissNotice: () => void;
  onBook: () => void;
  /** Called once the viewer has confirmed leaving, in the one confirmation this block owns. */
  onCancelRsvp: () => void;
  /** The "Add to calendar" control; the page owns what it does. Left out once the event is over. */
  calendarAction: ReactNode;
  host: EventHost | null;
  onContactHost: () => void;
  /** The Policies section exists, so the link to it does not point at nothing. */
  policiesVisible: boolean;
  onSignIn: () => void;
  /** The signed-in bottom navigation is on screen (it moves the phone's booking bar up). */
  bottomNav: boolean;
}

const NOTICE_ICON = { success: CheckCircle, info: CheckCircle, error: TriangleAlert } as const;

/**
 * The whole booking surface of an Event page, once. Every fact in it is stated one time, in this order: when and where (with the countdown),
 * the price and the places left beside the single booking control, the two secondary rows (calendar, map), the host, who is going, and a
 * link to the policies. Nothing in the hero or below repeats any of it.
 *
 * The one primary button: it sits in this block, and on a phone, once the block has scrolled out of sight, it moves (it is not copied)
 * into a bar at the bottom of the screen, so there is never more than one booking button in the page.
 */
export function EventBookingBlock({
  eventId, eventTitle, startTime, countdown, isPast, isCancelled, isCompleted, isOnline, onlineFormat, venueName, venueAddress, venueDetailsVisible,
  isAuthenticated, isHost, viewerId, priceLabel, ticketUrl, capacity, participantCount, attendees, attendeesVisible, control, reason, joining,
  rsvpNotice, onDismissNotice, onBook, onCancelRsvp, calendarAction, host, onContactHost, policiesVisible, onSignIn, bottomNav,
}: EventBookingBlockProps) {
  const reasonId = useId();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const stackRef = useRef<HTMLButtonElement>(null);
  const slotElement = useRef<HTMLDivElement | null>(null);
  const focusControlAfterLeave = useRef(false);

  // Leaving needs an account: a guest who just RSVP'd has nothing to cancel from here.
  const shown: EventBookingControl = { ...control, cancellable: control.cancellable && isAuthenticated };
  const leaving = shown.cancelLabel === "Leave waitlist";

  // The control lives in `slot` while the block is on screen, and in the bar under a phone screen once it is not. Only an actionable control
  // is worth following the viewer; a status ("Going", "Sold out", "Ended") stays where it is.
  const [observeSlot, slotOnScreen] = useIsOnScreen<HTMLDivElement>();
  const slotRef = useCallback((node: HTMLDivElement | null) => {
    slotElement.current = node;
    observeSlot(node);
  }, [observeSlot]);
  const belowLg = useMediaQuery("(max-width: 1023px)");
  const docked = belowLg && !slotOnScreen && shown.kind === "primary";

  // After leaving, the control the viewer used is gone: focus goes to the control that replaced it, not to the top of the page.
  useEffect(() => {
    if (!focusControlAfterLeave.current || joining) return;
    focusControlAfterLeave.current = false;
    slotElement.current?.querySelector<HTMLElement>("button")?.focus();
  }, [joining, shown.label]);

  const live = !isPast && !isCancelled && !isCompleted;
  const showCountdown = !isPast && !isCancelled && countdown && !countdown.ended;
  const happeningNow = !isPast && !isCancelled && !!countdown?.ended;
  const places = placesLeftLabel(capacity, participantCount);
  // The map button needs details the host has not hidden. A signed-in viewer gets it for a named or addressed venue; a visitor is offered
  // the sign-in to it only when there is an address to open.
  const hasMap = !isOnline && venueDetailsVisible && (isAuthenticated ? !!(venueAddress || venueName) : !!venueAddress);
  const mapNeedsAccount = hasMap && !isAuthenticated;
  const venueLabel = isOnline
    ? `Online event${onlineFormat ? ` · ${onlineFormat}` : ""}`
    : venueName || (venueAddress && !isAuthenticated ? "Sign in to see the full address" : "Location to be announced");
  const NoticeIcon = rsvpNotice ? NOTICE_ICON[rsvpNotice.tone] : null;

  const control_ = (
    <EventBookingCta
      control={shown}
      joining={joining}
      onBook={onBook}
      onCancel={() => setConfirmCancel(true)}
      describedBy={reason ? reasonId : undefined}
    />
  );

  return (
    <>
      <section aria-label="Event booking" className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {/* 1. When and where */}
        <div data-booking-section="status" className="space-y-1.5">
          {showCountdown && countdown && (
            <div
              role="timer"
              aria-label={`${countdown.days} days, ${countdown.hours} hours, and ${countdown.minutes} minutes until the event`}
              className="flex flex-wrap items-center gap-x-2 text-sm"
            >
              <span className="font-semibold text-foreground">Starts in</span>
              <span className="text-muted-foreground">{countdown.days} days · {countdown.hours} hours · {countdown.minutes} mins</span>
            </div>
          )}
          {happeningNow && <p className="text-sm font-semibold text-primary">Happening now</p>}
          <p className="text-base font-semibold leading-snug" title={`Shown in your local timezone (${eventTimeZone()})`}>
            {formatEventTime(startTime)} · local time
          </p>
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{venueLabel}</span>
          </p>
        </div>

        {rsvpNotice && NoticeIcon && (
          <div
            role={rsvpNotice.tone === "error" ? "alert" : "status"}
            data-rsvp-notice={rsvpNotice.tone}
            className="flex items-start gap-2 text-sm"
          >
            <NoticeIcon className={cn("mt-0.5 h-4 w-4 shrink-0", rsvpNotice.tone === "error" ? "text-destructive" : "text-primary")} aria-hidden />
            <p className={cn("min-w-0 flex-1", rsvpNotice.tone === "error" ? "text-destructive" : "text-foreground")}>{rsvpNotice.text}</p>
            <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-7 w-7 shrink-0" aria-label="Dismiss message" onClick={onDismissNotice}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}

        {/* 2. Price, places left, and the one control */}
        <div data-booking-section="admission" role="group" aria-label="Booking" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 text-2xl font-bold leading-tight">{priceLabel || "Free"}</p>
            {places && <p className="text-sm text-muted-foreground">{places}</p>}
          </div>
          {/* The slot keeps the button's height while the button is in the bar, so nothing moves when it leaves or comes back. */}
          <div ref={slotRef} data-booking-slot className={shown.kind === "primary" ? "min-h-12" : undefined}>
            {!docked && control_}
          </div>
          {ticketUrl && (
            <p className="text-sm text-muted-foreground">
              <a
                className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get tickets <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>{" "}
              Tickets and payment are handled by the seller, not by Kretopia.
            </p>
          )}
          {reason && <p id={reasonId} role="status" className="text-sm text-muted-foreground">{reason}</p>}
        </div>

        {/* 3. The two secondary rows */}
        {live && (calendarAction || hasMap) && (
          <div data-booking-section="secondary" className="space-y-2">
            {calendarAction}
            {hasMap && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => (mapNeedsAccount ? onSignIn() : openDirections(venueAddress, venueName))}
              >
                <Navigation className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {mapNeedsAccount ? "Sign in to open the map" : "Open map"}
              </Button>
            )}
          </div>
        )}

        {/* 4. Host */}
        <div data-booking-section="host" className="border-t border-border pt-4">
          <EventHostBlock host={host} isHost={isHost} isAuthenticated={isAuthenticated} onContact={onContactHost} onSignIn={onSignIn} />
        </div>

        {/* 5. Who is going: avatars only; the count is said here once */}
        <div data-booking-section="participants" className="border-t border-border pt-4">
          {participantCount === null ? (
            <p className="text-sm text-muted-foreground">Attendance count unavailable</p>
          ) : participantCount < 1 ? (
            <p className="text-sm text-muted-foreground">Be the first to join.</p>
          ) : attendeesVisible ? (
            <EventAttendeeStack
              ref={stackRef}
              attendees={attendees}
              totalCount={participantCount}
              visible
              onOpen={() => setParticipantsOpen(true)}
            />
          ) : (
            <p className="text-sm font-medium tabular-nums">{participantCount} going</p>
          )}
        </div>

        {/* 6. Policies: a link into About, not a row of its own */}
        {policiesVisible && (
          <p className="text-xs text-muted-foreground">
            <a className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#about-policies">
              Event policies
            </a>
          </p>
        )}
      </section>

      {docked && <EventStickyBookingBar bottomNav={bottomNav}>{control_}</EventStickyBookingBar>}

      <EventParticipantsDialog
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        eventId={eventId}
        canSee={attendeesVisible}
        viewerId={viewerId}
        viewerIsHost={isHost}
        returnFocusRef={stackRef}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{leaving ? "Leave the waitlist?" : "Release your spot?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {leaving
                ? `You'll lose your place in the queue for ${eventTitle}.`
                : `You won't be able to attend ${eventTitle}. Your pass stops working and the place goes to the next person on the waitlist.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{leaving ? "Stay on the waitlist" : "Keep my spot"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancel(false);
                focusControlAfterLeave.current = true;
                onCancelRsvp();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? "Yes, leave waitlist" : "Yes, cancel RSVP"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default EventBookingBlock;
