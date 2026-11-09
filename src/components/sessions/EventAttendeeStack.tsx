import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface EventAttendeePreview {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface EventAttendeeStackProps {
  attendees: EventAttendeePreview[];
  totalCount: number;
  visible: boolean;
}

export function EventAttendeeStack({ attendees, totalCount, visible }: EventAttendeeStackProps) {
  if (!visible || totalCount < 1) return null;

  const visibleAttendees = attendees.slice(0, 3);
  const overflow = Math.max(0, totalCount - visibleAttendees.length);

  return (
    <div className="flex items-center gap-3" role="group" aria-label={`${totalCount} attendees going`}>
      <div className="flex items-center pl-2">
        {visibleAttendees.map((attendee) => (
          <Avatar key={attendee.id} className="-ml-2 h-9 w-9 border-2 border-background">
            <AvatarImage src={attendee.avatarUrl || undefined} alt="" />
            <AvatarFallback aria-hidden>{attendee.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
            <span className="sr-only">{attendee.name}</span>
          </Avatar>
        ))}
        {overflow > 0 && (
          <span
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-foreground"
            aria-label={`${overflow} more attendees`}
          >
            +{overflow}
          </span>
        )}
      </div>
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {totalCount} going
      </p>
    </div>
  );
}
