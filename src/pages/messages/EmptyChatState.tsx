import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";
import type { OtherUser } from "./types";

interface Props {
  otherUser: OtherUser | null;
  isOnline: boolean;
  onViewProfile: () => void;
  onStartProject: () => void;
}

export const EmptyChatState = ({ otherUser, isOnline, onViewProfile, onStartProject }: Props) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-12">
    <div className="relative mb-4">
      <Avatar className="h-20 w-20 ring-4 ring-primary/10">
        <AvatarImage src={otherUser?.avatar} />
        <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-accent/20">
          {(otherUser?.name || 'U').split(" ").map((n) => n[0]).join("")}
        </AvatarFallback>
      </Avatar>
      {isOnline && <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background" />}
    </div>
    <h3 className="text-lg font-semibold mb-1">{otherUser?.name || 'Unknown'}</h3>
    {otherUser?.role && <Badge variant="secondary" className="mb-3 text-xs">{otherUser.role}</Badge>}
    <div className="flex gap-2 mb-4">
      <Button onClick={onViewProfile} variant="outline" size="sm" className="rounded-full text-xs">View Profile</Button>
      <Button onClick={onStartProject} variant="outline" size="sm" className="rounded-full text-xs gap-1">
        <Briefcase className="h-3 w-3" /> Start Project
      </Button>
    </div>
    <p className="text-xs text-muted-foreground max-w-[240px]">
      Pick a conversation starter above or type your own message to connect
    </p>
  </div>
);
