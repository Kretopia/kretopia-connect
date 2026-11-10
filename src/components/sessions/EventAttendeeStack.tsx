import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface EventAttendeePreview {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface EventAttendeeStackProps {
  attendees: EventAttendeePreview[];
  /** The server's count of people going. It is said once, here. */
  totalCount: number;
  /** The host's visibility setting, already applied by the page: false draws nothing. */
  visible: boolean;
  /** When given, the whole stack is one button that opens the list of everyone going. */
  onOpen?: () => void;
  className?: string;
}

const MAX_CIRCLES = 3;

/**
 * Who is going, as overlapping round avatars and a "+N". It carries the one "N going" of the page. With `onOpen` it is a button; its
 * accessible label is plain text ("12 going: Ana, Bo, Cy and 9 more. View everyone going."), so the overflow is announced and not only drawn.
 */
export const EventAttendeeStack = forwardRef<HTMLButtonElement, EventAttendeeStackProps>(function EventAttendeeStack(
  { attendees, totalCount, visible, onOpen, className },
  ref,
) {
  if (!visible || totalCount < 1) return null;

  const shown = attendees.slice(0, MAX_CIRCLES);
  const overflow = Math.max(0, totalCount - shown.length);
  const names = shown.map((attendee) => attendee.name).join(", ");
  const spoken = `${names}${names && overflow > 0 ? " and " : ""}${overflow > 0 ? `${overflow} more` : ""}`;
  // The label starts with the visible words ("6 going"), then says who and how many more, in text: the "+3" is only a drawing.
  const label = `${totalCount} going${spoken ? `: ${spoken}` : ""}`;

  const content = (
    <>
      <span aria-hidden className="flex items-center pl-2">
        {shown.map((attendee) => (
          <Avatar key={attendee.id} className="-ml-2 h-9 w-9 border-2 border-background">
            <AvatarImage src={attendee.avatarUrl || undefined} alt="" />
            <AvatarFallback>{attendee.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 && (
          <span className="-ml-2 flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-xs font-semibold text-foreground">
            +{overflow}
          </span>
        )}
      </span>
      <span className="text-sm font-medium tabular-nums">{totalCount} going</span>
    </>
  );

  if (onOpen) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`${label}. View everyone going.`}
        data-event-attendees="stack"
        className={cn(
          "-mx-1 inline-flex items-center gap-3 rounded-full px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div data-event-attendees="stack" role="group" aria-label={label} className={cn("inline-flex items-center gap-3", className)}>
      {content}
    </div>
  );
});

export default EventAttendeeStack;
