import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";
import { CardRow } from "@/components/cards/CardRow";
import { CardPill } from "@/components/cards/CardShell";

export interface NearbySession {
  id: string;
  title: string;
  description?: string;
  category: string;
  venue_name?: string;
  venue_address?: string;
  start_time: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  participant_count: number;
  max_participants: number;
  creator_name: string;
  creator_avatar?: string;
  created_by: string;
}

interface SessionListItemProps {
  session: NearbySession;
  isSelected: boolean;
  onClick: () => void;
  formatDistance: (km: number) => string;
}

/** A session in the map's sidebar, as a row of the shared card. The dashed amber ring and the count on the avatar keep telling sessions from people. */
export const SessionListItem = ({ session, isSelected, onClick }: SessionListItemProps) => {
  const startTime = new Date(session.start_time);
  const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <CardRow
      testId={`nearby-session-${session.id}`}
      title={session.title}
      open={{ onClick }}
      selected={isSelected}
      lead={
        <div className="relative">
          <Avatar className="h-10 w-10 border-2 border-dashed border-amber-500">
            <AvatarImage src={session.creator_avatar || undefined} />
            <AvatarFallback className="bg-amber-500/10 text-sm text-amber-600"></AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white" title={`${session.participant_count} going`}>
            {session.participant_count}
          </div>
        </div>
      }
      meta={session.category}
      tags={[<CardPill key="when" className="text-amber-600"><Calendar className="h-3 w-3" aria-hidden />{dateStr} {timeStr}</CardPill>]}
    />
  );
};
