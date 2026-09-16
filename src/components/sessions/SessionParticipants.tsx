import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserMinus, MessageCircle, UserPlus, Crown, Download, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Participant {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  is_visible?: boolean;
  profile: {
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
}

interface SessionParticipantsProps {
  sessionId: string;
  creatorId: string;
  isCreator: boolean;
  onRefresh?: () => void;
}

export const SessionParticipants = ({
  sessionId,
  creatorId,
  isCreator,
  onRefresh,
}: SessionParticipantsProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [creator, setCreator] = useState<{ full_name: string; avatar_url: string | null; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Participant | null>(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, [sessionId]);

  const loadParticipants = async () => {
    setLoading(true);
    
    // Fetch participants
    const { data: participantsData, error } = await supabase
      .from('jam_participants')
      .select('id, user_id, status, joined_at, is_visible')
      .eq('jam_id', sessionId)
      .in('status', ['going', 'interested', 'maybe'])
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error loading participants:', error);
    } else if (participantsData && participantsData.length > 0) {
      // Fetch profiles separately
      const userIds = participantsData.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .in('user_id', userIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      const formattedParticipants = participantsData.map(p => ({
        ...p,
        profile: profilesMap.get(p.user_id) || null
      }));
      setParticipants(formattedParticipants);
    } else {
      setParticipants([]);
    }

    // Fetch creator profile
    const { data: creatorData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('user_id', creatorId)
      .single();

    if (creatorData) {
      setCreator(creatorData);
    }

    setLoading(false);
  };

  const handleRemoveParticipant = async (participant: Participant) => {
    setRemovingId(participant.id);
    
    const { error } = await supabase
      .from('jam_participants')
      .delete()
      .eq('id', participant.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove participant",
        variant: "destructive",
      });
    } else {
      toast({ title: "Participant removed" });
      setParticipants(prev => prev.filter(p => p.id !== participant.id));
      onRefresh?.();
    }
    
    setRemovingId(null);
    setConfirmRemove(null);
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleMessage = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const myParticipation = participants.find(p => p.user_id === user?.id);
  const isMyVisible = myParticipation ? myParticipation.is_visible !== false : true;

  const handleToggleVisibility = async (visible: boolean) => {
    if (!myParticipation) return;
    setUpdatingVisibility(true);
    const { error } = await supabase
      .from('jam_participants')
      .update({ is_visible: visible })
      .eq('id', myParticipation.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
    } else {
      setParticipants(prev => prev.map(p => p.id === myParticipation.id ? { ...p, is_visible: visible } : p));
      toast({
        title: visible ? "You're visible to other attendees" : "You're hidden from attendees",
        description: visible ? "Others can see you in the attendee list." : "Only the host can see you.",
      });
    }
    setUpdatingVisibility(false);
  };

  // Filter visible participants — host sees all, others see only opt-in
  const visibleParticipants = isCreator
    ? participants
    : participants.filter(p => p.is_visible !== false || p.user_id === user?.id);

  const handleDownloadGuestList = () => {
    const rows: string[][] = [["Name", "Role", "Status", "Joined At"]];

    if (creator) {
      rows.push([creator.full_name || "Unknown", creator.role || "", "Host", ""]);
    }

    participants.forEach((p) => {
      rows.push([
        p.profile?.full_name || "Unknown",
        p.profile?.role || "",
        p.status,
        p.joined_at ? new Date(p.joined_at).toLocaleDateString() : "",
      ]);
    });

    const csv = rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-list-${sessionId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Guest list downloaded" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 sm:p-6 space-y-4">
          {/* Host Section */}
          {creator && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Host</h4>
              <div 
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 cursor-pointer hover:bg-amber-500/10 transition-colors"
                onClick={() => handleViewProfile(creatorId)}
              >
                <Avatar className="h-12 w-12 ring-2 ring-amber-500/30">
                  <AvatarImage src={creator.avatar_url || undefined} />
                  <AvatarFallback className="bg-amber-500/10 text-amber-600">
                    {creator.full_name?.charAt(0) || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{creator.full_name}</p>
                    <Crown className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{creator.role}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessage(creatorId);
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Visibility opt-in for current attendee */}
          {myParticipation && !isCreator && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <EyeOff className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Show me to other attendees</p>
                  <p className="text-xs text-muted-foreground">
                    {isMyVisible ? "Other attendees can see your profile here." : "Only the host can see you."}
                  </p>
                </div>
              </div>
              <Switch
                checked={isMyVisible}
                disabled={updatingVisibility}
                onCheckedChange={handleToggleVisibility}
              />
            </div>
          )}

          {/* Participants Section */}
          <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Participants ({visibleParticipants.length}{!isCreator && participants.length > visibleParticipants.length ? ` of ${participants.length}` : ''})
            </h4>
            {isCreator && participants.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleDownloadGuestList}>
                <Download className="h-3.5 w-3.5" />
                Download List
              </Button>
            )}
          </div>
            
            {visibleParticipants.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No one has joined yet</p>
                <p className="text-sm text-muted-foreground/70">Be the first to join!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleParticipants.map((participant) => (
                  <div 
                    key={participant.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleViewProfile(participant.user_id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {participant.profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {participant.profile?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {participant.profile?.role || 'Creator'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {participant.status}
                      </Badge>
                      {isCreator && participant.is_visible === false && (
                        <Badge variant="secondary" className="text-[10px] gap-1"><EyeOff className="h-2.5 w-2.5" /> Hidden</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessage(participant.user_id);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      {isCreator && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmRemove(participant);
                          }}
                          disabled={removingId === participant.id}
                        >
                          {removingId === participant.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Confirm Remove Dialog */}
      <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Participant?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {confirmRemove?.profile?.full_name || 'this participant'} from the session? 
              They will be able to rejoin unless you also block them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && handleRemoveParticipant(confirmRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
