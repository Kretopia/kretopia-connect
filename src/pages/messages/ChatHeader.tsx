import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreVertical, Trash2, Briefcase, FolderPlus, Video, Loader2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnlineDot } from "@/components/messages/OnlinePresence";
import { InviteToProjectDialog } from "@/components/project/InviteToProjectDialog";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { StartMeetingDialog } from "@/components/calls/StartMeetingDialog";
import { CallStartChooser } from "@/components/calls/CallStartChooser";
import { useStartDirectCall } from "@/hooks/useStartDirectCall";
import type { OtherUser } from "./types";

interface Props {
  otherUser: OtherUser;
  isOnline: boolean;
  onBack: () => void;
  onViewProfile: () => void;
  onStartProject: () => void;
}

export const ChatHeader = ({ otherUser, isOnline, onBack, onViewProfile, onStartProject }: Props) => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const recipientId = (otherUser as any).id || (otherUser as any).user_id;
  const { starting, session, open, setOpen, start, myName } = useStartDirectCall();

  const handleVideoTap = () => {
    if (!recipientId) return;
    setChooserOpen(true);
  };

  const handleInstantCall = () => {
    if (!recipientId) return;
    setChooserOpen(false);
    void start(recipientId, otherUser.name || "guest", { context: "chat-header" });
  };

  const handleGroupLink = () => {
    setChooserOpen(false);
    setGroupCallOpen(true);
  };

  return (
    <div className="p-3 sm:p-4 border-b border-border flex items-center gap-2.5 sm:gap-3 bg-card">
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="relative">
        <Avatar className="h-9 w-9 sm:h-11 sm:w-11 cursor-pointer border-2 border-background" onClick={onViewProfile}>
          <AvatarImage src={otherUser.avatar} />
          <AvatarFallback className="text-sm sm:text-lg">
            {(otherUser.name || 'U').split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <OnlineDot isOnline={isOnline} />
      </div>
      <div className="flex-1 cursor-pointer" onClick={onViewProfile}>
        <h3 className="font-semibold hover:underline">{otherUser.name || 'Unknown'}</h3>
        <p className="text-xs text-muted-foreground">
          {isOnline ? <span className="text-success">Online</span> : (otherUser.role || '')}
        </p>
      </div>
      {recipientId && (
        <Button
          type="button"
          size="icon"
          variant="default"
          className="h-9 w-9 rounded-full"
          onClick={handleVideoTap}
          disabled={starting}
          aria-label={`Video call ${otherUser.name || 'user'}`}
          title="Start video call"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
        </Button>
      )}
      <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={onStartProject}>
        <Briefcase className="h-4 w-4" />
        Start Project
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onViewProfile}>View Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={onStartProject} className="sm:hidden">
            <Briefcase className="h-4 w-4 mr-2" />
            Start Project Together
          </DropdownMenuItem>
          {recipientId && (
            <DropdownMenuItem onClick={() => setGroupCallOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Group call with link…
            </DropdownMenuItem>
          )}
          {recipientId && (
            <DropdownMenuItem onClick={() => setInviteOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Add to existing project
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {recipientId && (
        <InviteToProjectDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          recipientUserId={recipientId}
          recipientName={otherUser.name || 'this user'}
        />
      )}
      <VideoCallSheet
        open={open}
        onOpenChange={setOpen}
        projectName={`Call with ${otherUser.name || 'guest'}`}
        roomUrl={session?.roomUrl ?? null}
        token={session?.token ?? null}
        callId={session?.callId ?? null}
        userName={myName}
        directCallId={session?.callId ?? null}
        roomName={session?.roomName ?? null}
        peerUserId={recipientId ?? null}
        peerName={otherUser.name || null}
      />
      {recipientId && (
        <StartMeetingDialog
          open={groupCallOpen}
          onOpenChange={setGroupCallOpen}
          source="dm"
          title={`Call with ${otherUser.name || "guest"}`}
          people={[{ id: recipientId, name: otherUser.name || "Friend", avatar: otherUser.avatar, preselected: true }]}
        />
      )}
      <CallStartChooser
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        instantLabel={`Ring ${otherUser.name || "them"} now`}
        instantHint="Calls them on Kretopia with a ringtone."
        linkLabel="Get a meeting link to share"
        linkHint="Open a room with a link — perfect for guests on WhatsApp or email."
        onPickInstant={handleInstantCall}
        onPickLink={handleGroupLink}
        starting={starting}
      />
    </div>
  );
};
