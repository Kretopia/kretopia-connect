import { CalendarPlus, Check, ChevronDown } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadIcs } from "@/lib/eventActions";
import { googleCalendarUrl } from "@/lib/eventCalendar";
import { cn } from "@/lib/utils";

export interface CalendarActionEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  venueName?: string | null;
  /** Already filtered by what the viewer may see: a hidden venue is not exported. */
  venueAddress?: string | null;
  url?: string;
}

interface EventCalendarActionsProps {
  event: CalendarActionEvent;
  signedIn: boolean;
  /** Saving to the Kretopia calendar can work (the table exists). */
  saveAvailable: boolean;
  saved: boolean;
  busy: boolean;
  onToggleSaved: () => void;
  onSignIn: () => void;
  /** "menu": one compact control with two labelled groups (for a row or a rail). "buttons": the two actions side by side. */
  layout?: "menu" | "buttons";
  size?: "sm" | "default";
  className?: string;
  /** Draw the label at every width (a full-width row has room for it); by default a narrow row shows the icon only. */
  labelAlways?: boolean;
}

const UNAVAILABLE = "Saving to your Kretopia calendar isn't available yet. You can still export this event.";

/**
 * The calendar actions of an event, kept apart from RSVP and tickets, in two clearly named groups:
 *   - My Kretopia calendar: put the event on the member's own calendar (or take it off). It is not an RSVP and reserves nothing.
 *   - Export to another calendar: a .ics file or Google Calendar. It needs no account.
 */
export function EventCalendarActions({ event, signedIn, saveAvailable, saved, busy, onToggleSaved, onSignIn, layout = "menu", size = "sm", className, labelAlways = false }: EventCalendarActionsProps) {
  const unavailable = signedIn && !saveAvailable;
  const exportIcs = () => downloadIcs(event);
  const exportGoogle = () => window.open(googleCalendarUrl(event), "_blank", "noopener,noreferrer");
  const saveLabel = saved ? "Remove from my calendar" : signedIn ? "Add to my calendar" : "Sign in to add to my calendar";

  if (layout === "buttons") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Calendar">
        <Button
          type="button"
          size={size}
          variant={saved ? "secondary" : "outline"}
          aria-pressed={signedIn ? saved : undefined}
          disabled={busy || unavailable}
          onClick={signedIn ? onToggleSaved : onSignIn}
        >
          {busy ? <KretopiaSpinner className="mr-1.5 h-3.5 w-3.5" /> : saved ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> : <CalendarPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
          {saved ? "On my calendar" : "Add to my calendar"}
        </Button>
        <Button type="button" size={size} variant="outline" onClick={exportIcs}>Export .ics</Button>
        <Button type="button" size={size} variant="outline" onClick={exportGoogle}>Google Calendar</Button>
        {unavailable && <p role="status" className="basis-full text-xs text-muted-foreground">{UNAVAILABLE}</p>}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size={size} variant={saved ? "secondary" : "outline"} className={className} aria-label={saved ? "Calendar: on my calendar" : "Add to calendar"}>
          {/* On a phone the When row beside it is narrow, so the label gives way to the icon (a plus for "add", a check once it is on the calendar,
              and the button's fill changes too); the accessible name above is the full label at every size, and from sm the label is drawn. */}
          {saved ? <Check className={cn("h-3.5 w-3.5", labelAlways ? "mr-1.5" : "sm:mr-1.5")} aria-hidden /> : <CalendarPlus className={cn("h-3.5 w-3.5", labelAlways ? "mr-1.5" : "sm:mr-1.5")} aria-hidden />}
          <span className={labelAlways ? undefined : "hidden sm:inline"}>{saved ? "On my calendar" : "Add to calendar"}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>My Kretopia calendar</DropdownMenuLabel>
        <DropdownMenuItem disabled={busy || unavailable} onSelect={() => (signedIn ? onToggleSaved() : onSignIn())}>
          {saveLabel}
        </DropdownMenuItem>
        {unavailable && <p role="status" className="px-2 pb-1.5 text-xs text-muted-foreground">{UNAVAILABLE}</p>}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export to another calendar</DropdownMenuLabel>
        <DropdownMenuItem onSelect={exportIcs}>.ics file (Apple, Outlook)</DropdownMenuItem>
        <DropdownMenuItem onSelect={exportGoogle}>Google Calendar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EventCalendarActions;
