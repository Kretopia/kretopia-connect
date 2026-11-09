import type { ReactNode } from "react";
import { useSharedFooter } from "@/components/layout/sharedFooter";
import { WrappedShell } from "@/components/wrapped/WrappedShell";

export const EVENT_PAGE_CONTENT_CLASS = "mx-auto w-full max-w-7xl px-4 md:px-6 xl:px-8";

interface EventPageShellProps {
  eventTitle: string;
  hero: ReactNode;
  about: ReactNode;
  attendees: ReactNode;
  calendar: ReactNode;
  host: ReactNode;
  bookingRail: ReactNode;
  afterHost?: ReactNode;
  /** The host's own tools: drawn right under the header (the hero), before the page's content. Pass nothing for a visitor. */
  hostTools?: ReactNode;
}

export function EventPageShell({
  eventTitle,
  hero,
  about,
  attendees,
  calendar,
  host,
  bookingRail,
  afterHost,
  hostTools,
}: EventPageShellProps) {
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
      contentClassName="space-y-6"
      className="min-h-screen w-full max-w-none !overflow-visible !rounded-none !border-0 !bg-background !p-0"
    >
      {hero}
      {hostTools ? <div className={EVENT_PAGE_CONTENT_CLASS}>{hostTools}</div> : null}
      <div className={`${EVENT_PAGE_CONTENT_CLASS} ${sharedFooter ? "pb-10" : "pb-32"}`}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0 space-y-6">
            {about}
            {attendees}
            {calendar}
            {host}
            {afterHost}
          </main>
          <aside
            id="event-booking"
            aria-label="Event booking"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:col-start-2 lg:row-start-1 lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm"
          >
            {bookingRail}
          </aside>
        </div>
      </div>
    </WrappedShell>
  );
}

export default EventPageShell;
