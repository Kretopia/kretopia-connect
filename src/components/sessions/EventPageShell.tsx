import type { ReactNode } from "react";
import { useSharedFooter } from "@/components/layout/sharedFooter";
import { WrappedShell } from "@/components/wrapped/WrappedShell";

/** The one width and the one pair of gutters of the Event page. Only this shell applies it: no component inside sets its own. */
export const EVENT_PAGE_CONTENT_CLASS = "mx-auto w-full max-w-7xl px-4 md:px-6 xl:px-8";

interface EventPageShellProps {
  eventTitle: string;
  /** The cover and the title. */
  hero: ReactNode;
  /**
   * The one booking block (see EventBookingBlock). It is drawn right after the hero on a phone, and in the sticky right-hand rail from `lg`;
   * the same single element in both places, positioned by the grid below.
   */
  booking: ReactNode;
  /** Notices about the event itself (cancelled, completed): the first thing on the page, above the cover. */
  notices?: ReactNode;
  /** The host's own tools, right under the hero. Pass nothing for a visitor. */
  hostTools?: ReactNode;
  about: ReactNode;
  gallery?: ReactNode;
  crew: ReactNode;
  calendar: ReactNode;
  afterCrew?: ReactNode;
}

/**
 * The frame of an Event page, once: the shared Wrapped surface, the page width and gutters, and the rhythm between sections. Every part
 * of the page is placed here and nowhere else; the parts themselves set no outer margin, padding or width.
 */
export function EventPageShell({ eventTitle, hero, booking, notices, hostTools, about, gallery, crew, calendar, afterCrew }: EventPageShellProps) {
  // Below lg the booking bar is fixed to the bottom of the screen. With no footer under the page the content keeps the room for it; under the
  // shared footer the footer keeps that room at its own foot (see footerBottomReserve), so the page does not end in an empty band above it.
  const sharedFooter = useSharedFooter();
  return (
    <WrappedShell
      titleId="event-page-shell-heading"
      eyebrow="Kretopia · Event"
      title={eventTitle}
      brandFooter={false}
      showHeader={false}
      showHudCorners={false}
      contentClassName="space-y-0"
      className="min-h-screen w-full max-w-none !overflow-visible !rounded-none !border-0 !bg-background !p-0"
    >
      <div className={`${EVENT_PAGE_CONTENT_CLASS} space-y-6 pt-4 md:pt-6 ${sharedFooter ? "pb-10" : "pb-40"}`}>
        {notices}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div data-event-slot="hero" className="min-w-0 lg:col-start-1 lg:row-start-1">{hero}</div>
          <div
            id="event-booking"
            data-event-slot="booking"
            className="min-w-0 scroll-mt-24 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          >
            {booking}
          </div>
          <div data-event-slot="main" className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
            {hostTools}
            {about}
            {gallery}
            {crew}
            {calendar}
            {afterCrew}
          </div>
        </div>
      </div>
    </WrappedShell>
  );
}

export default EventPageShell;
