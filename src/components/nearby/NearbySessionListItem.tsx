import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";

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

export const SessionListItem = ({ session, isSelected, onClick, formatDistance }: SessionListItemProps) => {
  const startTime = new Date(session.start_time);
  const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-amber-500 shadow-md' : 'hover:shadow-md'}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-dashed border-amber-500">
              <AvatarImage src={session.creator_avatar || undefined} />
              <AvatarFallback className="bg-amber-500/10 text-amber-600 text-sm"></AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
              {session.participant_count}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{session.title}</h4>
            <p className="text-xs text-muted-foreground truncate">{session.category}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dateStr} {timeStr}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
